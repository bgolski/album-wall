import sharp from "sharp";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { allowedCoverUrl, fetchCover } from "../cover-image/index";
import {
  POSTER_PIXELS,
  POSTER_RADIUS,
  posterLayout as layoutFor,
  type PosterSize,
} from "../../../src/utils/posterLayout";

// Posters: the wall drawn at print resolution. Phones cannot draw a canvas this large, and a
// poster should come out the same whatever device asked, so it is made here. Each one takes real
// compute, so the number made in a day is capped in code (a counter in DynamoDB), which keeps the
// month inside the always-free allowance however it is used.

/** Sizes in inches, at 300 dots per inch; a wider wall turns the poster sideways. */
export const SIZES = POSTER_PIXELS;
export type { PosterSize };
export type PosterBackground = "dark" | "light" | "record";

const BACKGROUNDS: Record<PosterBackground, string> = {
  dark: "#0b0f17",
  light: "#f1f3f9",
  record: "#0b0f17",
};

const MAX_TILES = 150;
const MAX_BODY_BYTES = 64_000;
const COVER_PARALLELISM = 8;
const JPEG_QUALITY = 90;

type PosterEvent = {
  body?: string;
  isBase64Encoded?: boolean;
  requestContext?: { http?: { method?: string } };
};

export interface PosterRequest {
  size: PosterSize;
  background: PosterBackground;
  rows: number;
  columns: number;
  /** One cover address for each spot, row by row; empty where there is none. */
  covers: string[];
}

export interface PosterResult {
  statusCode: number;
  headers: Record<string, string>;
  body: Buffer | string;
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-expose-headers": "x-covers-left-out",
};

const respond = (statusCode: number, message: string): PosterResult => ({
  statusCode,
  headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", ...CORS },
  body: message,
});

/**
 * Reads a poster request, allowing only what the app sends: a known size and background, a wall
 * of a sensible shape, and cover addresses from the hosts the cover service may fetch.
 *
 * @param text The request body.
 * @returns The request, or a message saying what is wrong with it.
 */
export function parsePosterRequest(text: string): PosterRequest | string {
  if (text.length > MAX_BODY_BYTES) return "Request is too large.";
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return "Expected JSON.";
  }
  if (typeof value !== "object" || value === null) return "Expected an object.";
  const { size, background, rows, columns, covers } = value as Record<string, unknown>;
  if (typeof size !== "string" || !(size in SIZES))
    return `size must be one of ${Object.keys(SIZES).join(", ")}.`;
  if (typeof background !== "string" || !(background in BACKGROUNDS)) return "Unknown background.";
  if (!Number.isInteger(rows) || !Number.isInteger(columns))
    return "rows and columns must be whole numbers.";
  const r = rows as number;
  const c = columns as number;
  if (r < 1 || c < 1 || r * c > MAX_TILES) return `The wall must have 1 to ${MAX_TILES} spots.`;
  if (!Array.isArray(covers) || covers.length !== r * c)
    return "covers must have one entry for each spot.";
  if (
    !covers.every((cover) => typeof cover === "string" && (cover === "" || allowedCoverUrl(cover)))
  ) {
    return "A cover address is not allowed.";
  }
  return {
    size: size as PosterSize,
    background: background as PosterBackground,
    rows: r,
    columns: c,
    covers: covers as string[],
  };
}

/**
 * Where everything goes on the poster (the same layout the app's preview uses).
 *
 * @param request The parsed request.
 * @returns The poster's size and the wall's place on it, in pixels.
 */
export const posterLayout = (request: Pick<PosterRequest, "size" | "rows" | "columns">) =>
  layoutFor(request.size, request.rows, request.columns);

/**
 * The record from behind the app as an SVG: rings, and two soft bands of light. Numbers follow
 * `.record-backdrop__disc` in the app's styles.
 */
export function recordSvg(width: number, height: number): string {
  const centerX = width / 2;
  const centerY = height / 2;
  const unit = Math.max(1, Math.min(width, height) / 700);
  const reach = Math.hypot(width, height) / 2;
  const rings: string[] = [];
  for (let at = 4 * unit, n = 0; at < reach; at += 4.5 * unit, n += 1) {
    rings.push(
      `<circle cx="${centerX}" cy="${centerY}" r="${at.toFixed(1)}" fill="none" stroke="rgb(230,233,240)" stroke-opacity="${n % 2 === 0 ? 0.05 : 0.03}" stroke-width="${unit.toFixed(2)}"/>`
    );
  }
  // Each band rises from nothing to its peak and back to nothing across 30 degrees, drawn as thin
  // wedges (the page uses a conic gradient, which SVG does not have).
  const wedges: string[] = [];
  const point = (degrees: number) => {
    const radians = (degrees * Math.PI) / 180;
    return `${(centerX + reach * 1.05 * Math.sin(radians)).toFixed(1)},${(centerY - reach * 1.05 * Math.cos(radians)).toFixed(1)}`;
  };
  for (const start of [0, 180]) {
    const steps = 20;
    for (let step = 0; step < steps; step += 1) {
      const from = start + (step / steps) * 55;
      const to = start + ((step + 1) / steps) * 55;
      const middle = (from + to) / 2 - start;
      const strength = middle < 25 ? middle / 25 : Math.max(0, (55 - middle) / 30);
      if (strength <= 0) continue;
      wedges.push(
        `<path d="M${centerX},${centerY} L${point(from)} L${point(to)} Z" fill="rgb(129,140,248)" fill-opacity="${(0.1 * strength).toFixed(4)}"/>`
      );
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${rings.join("")}${wedges.join("")}</svg>`;
}

/** A tile: the cover cropped to a square with rounded corners, or a plain square without one. */
async function makeTile(cover: Buffer | null, size: number, fill: string) {
  const radius = Math.round(size * POSTER_RADIUS);
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" ry="${radius}"/></svg>`
  );
  const base = cover
    ? sharp(cover, { limitInputPixels: 40_000_000 }).rotate().resize(size, size, { fit: "cover" })
    : sharp({ create: { width: size, height: size, channels: 3, background: fill } });
  return base
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

/** Runs `work` over the items a few at a time, keeping the order of the results. */
async function inParallel<T, R>(
  items: T[],
  limit: number,
  work: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await work(items[index]!, index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Draws the poster as a JPEG.
 *
 * @param request The parsed request.
 * @param load Downloads a cover; tests pass their own.
 * @returns The JPEG and how many covers could not be included.
 */
export async function renderPoster(
  request: PosterRequest,
  load: (url: URL) => Promise<Buffer> = fetchCover
): Promise<{ jpeg: Buffer; left: number; width: number; height: number }> {
  const layout = posterLayout(request);
  const fill = request.background === "light" ? "#d9deea" : "#1a2030";

  // A cover that appears twice is fetched once.
  const addresses = [...new Set(request.covers.filter(Boolean))];
  const bytes = new Map<string, Buffer | null>();
  await inParallel(addresses, COVER_PARALLELISM, async (address) => {
    try {
      bytes.set(address, await load(new URL(address)));
    } catch {
      bytes.set(address, null);
    }
  });

  let left = 0;
  const tiles = await inParallel(request.covers, 4, async (address, index) => {
    const source = address ? (bytes.get(address) ?? null) : null;
    if (address && !source) left += 1;
    return makeTile(source, layout.tile, fill);
  });

  const layers: sharp.OverlayOptions[] = [];
  if (request.background === "record") {
    layers.push({ input: Buffer.from(recordSvg(layout.width, layout.height)), left: 0, top: 0 });
  }
  tiles.forEach((tile, index) => {
    const row = Math.floor(index / request.columns);
    const column = index % request.columns;
    layers.push({
      input: tile,
      left: layout.left + column * (layout.tile + layout.gap),
      top: layout.top + row * (layout.tile + layout.gap),
    });
  });

  const jpeg = await sharp({
    create: {
      width: layout.width,
      height: layout.height,
      channels: 3,
      background: BACKGROUNDS[request.background],
    },
  })
    .composite(layers)
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
  return { jpeg, left, width: layout.width, height: layout.height };
}

/** The day, as the key of the counter: `poster-cap:YYYY-MM-DD` in UTC. */
export const capKey = (now: Date) => `poster-cap:${now.toISOString().slice(0, 10)}`;

const dynamo = new DynamoDBClient({});

/**
 * Takes one of today's posters, or says there are none left: a counter that only goes up while it
 * is under the cap, and expires by itself.
 *
 * @returns Whether a poster may be made.
 */
export async function takePosterSlot(
  now = new Date(),
  cap = Number(process.env.POSTER_DAILY_CAP ?? 0),
  table = process.env.SHARE_TABLE_NAME
): Promise<boolean> {
  if (!table || !(cap > 0)) return false;
  try {
    await dynamo.send(
      new UpdateItemCommand({
        TableName: table,
        Key: { id: { S: capKey(now) } },
        UpdateExpression: "ADD made :one SET expires = :expires",
        ConditionExpression: "attribute_not_exists(made) OR made < :cap",
        ExpressionAttributeValues: {
          ":one": { N: "1" },
          ":cap": { N: String(cap) },
          // The table forgets items on this attribute (epoch seconds); a week is plenty.
          ":expires": { N: String(Math.floor(now.getTime() / 1000) + 7 * 86400) },
        },
      })
    );
    return true;
  } catch (error) {
    if ((error as { name?: string }).name === "ConditionalCheckFailedException") return false;
    throw error;
  }
}

/**
 * Makes the handler's logic for `POST /poster`: check the request, take a slot for the day, draw.
 *
 * @param deps Replaceable parts, for tests.
 */
export const createPosterHandler = (
  deps: {
    takeSlot?: () => Promise<boolean>;
    render?: typeof renderPoster;
  } = {}
) =>
  async function handle(event: PosterEvent): Promise<PosterResult> {
    const method = event.requestContext?.http?.method ?? "POST";
    if (method === "OPTIONS") {
      return { statusCode: 204, headers: { ...CORS, "access-control-max-age": "86400" }, body: "" };
    }
    if (method !== "POST") return respond(405, "Only POST is supported.");
    const text = event.isBase64Encoded
      ? Buffer.from(event.body ?? "", "base64").toString("utf8")
      : (event.body ?? "");
    const request = parsePosterRequest(text);
    if (typeof request === "string") return respond(400, request);

    const takeSlot = deps.takeSlot ?? takePosterSlot;
    let allowed: boolean;
    try {
      allowed = await takeSlot();
    } catch (error) {
      console.error("Poster counter failed:", error instanceof Error ? error.message : error);
      return respond(503, "Posters are not available right now.");
    }
    if (!allowed) return respond(429, "Today's posters are used up. Try again tomorrow.");

    try {
      const { jpeg, left } = await (deps.render ?? renderPoster)(request);
      return {
        statusCode: 200,
        headers: {
          "content-type": "image/jpeg",
          "cache-control": "no-store",
          "x-covers-left-out": String(left),
          ...CORS,
        },
        body: jpeg,
      };
    } catch (error) {
      console.error("Poster could not be drawn:", error instanceof Error ? error.message : error);
      return respond(500, "The poster could not be made.");
    }
  };

// Lambda's streaming runtime provides `awslambda`; the response goes out as it is written, which
// lifts the 6 MB limit a plain response has (a large poster is tens of megabytes).
interface StreamingRuntime {
  streamifyResponse(
    handler: (event: PosterEvent, stream: NodeJS.WritableStream) => Promise<void>
  ): unknown;
  HttpResponseStream: {
    from(
      stream: NodeJS.WritableStream,
      meta: { statusCode: number; headers: Record<string, string> }
    ): NodeJS.WritableStream;
  };
}
const runtime = (globalThis as { awslambda?: Partial<StreamingRuntime> }).awslambda;

const handle = createPosterHandler();
export const handler =
  runtime?.streamifyResponse && runtime.HttpResponseStream
    ? runtime.streamifyResponse(async (event, stream) => {
        const result = await handle(event);
        const out = runtime.HttpResponseStream!.from(stream, {
          statusCode: result.statusCode,
          headers: result.headers,
        });
        out.write(result.body);
        out.end();
      })
    : undefined;
