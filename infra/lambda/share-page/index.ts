import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import sharp from "sharp";
import type { FunctionUrlEvent } from "../shared/http";

// The link preview image size most apps expect (Open Graph's large image).
const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;
const IMAGE_PADDING = 40;
// Gap between covers and corner radius, as a share of a cover's size (as on the wall).
const GAP_RATIO = 0.06;
const RADIUS_RATIO = 0.08;
const BACKGROUND = "#111827";
const PLACEHOLDER = "#1f2937";
const COVER_TIMEOUT_MS = 4000;
const MAX_COVER_BYTES = 5_000_000;
const COVER_CONCURRENCY = 8;
const SHARE_ID = /^\/w\/([A-Za-z0-9]{8})(\.jpg)?$/;
// Apps that fetch a link to draw its preview. They get a page with the wall's picture; people
// are sent straight to the app. iMessage fetches previews as facebookexternalhit and Twitterbot.
const PREVIEW_FETCHERS =
  /facebookexternalhit|facebot|twitterbot|slackbot|discordbot|whatsapp|telegrambot|linkedinbot|applebot|googlebot|bingbot|redditbot|skypeuripreview|pinterest|embedly|iframely|vkshare|mastodon|bluesky|signal/i;

type ShareResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
};

export type SharedWall = {
  payload: string;
  app: string;
  title: string;
  rows: number;
  columns: number;
  covers: string[];
};

const dynamo = new DynamoDBClient({});
const ssm = new SSMClient({});
let shareDomain: string | undefined;

function defaultApp() {
  return process.env.DEFAULT_APP_URL ?? "https://bradleygolski.com/album-wall/";
}

function redirect(location: string, cacheControl: string): ShareResponse {
  return { statusCode: 302, headers: { location, "cache-control": cacheControl } };
}

/** Escapes text for an HTML attribute or element. */
function escapeHtml(text: string) {
  return text.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!
  );
}

async function getShareDomain(): Promise<string> {
  if (shareDomain) return shareDomain;
  const result = await ssm.send(
    new GetParameterCommand({ Name: process.env.SHARE_DOMAIN_PARAMETER_NAME })
  );
  shareDomain = result.Parameter?.Value ?? "";
  return shareDomain;
}

async function getSharedWall(id: string): Promise<SharedWall | null> {
  const result = await dynamo.send(
    new GetItemCommand({ TableName: process.env.SHARE_TABLE_NAME, Key: { id: { S: id } } })
  );
  const item = result.Item;
  if (!item?.payload?.S || !item.app?.S) return null;
  let covers: string[] = [];
  try {
    const parsed = JSON.parse(item.covers?.S ?? "[]") as unknown;
    if (Array.isArray(parsed)) covers = parsed.map(String);
  } catch {
    // A damaged cover list draws placeholders.
  }
  return {
    payload: item.payload.S,
    app: item.app.S,
    title: item.title?.S ?? "Album Wall",
    rows: Number(item.rows?.N ?? 1),
    columns: Number(item.columns?.N ?? 1),
    covers,
  };
}

/**
 * The page link preview fetchers read: title, description and the wall's picture.
 */
export function previewPage(wall: SharedWall, pageUrl: string) {
  const title = escapeHtml(wall.title);
  const count = wall.covers.filter(Boolean).length || wall.rows * wall.columns;
  const description = escapeHtml(`A wall of ${count} records, arranged with Album Wall.`);
  const image = escapeHtml(`${pageUrl}.jpg`);
  const target = escapeHtml(`${wall.app}#share=${wall.payload}`);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<meta name="description" content="${description}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Album Wall">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${escapeHtml(pageUrl)}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="${IMAGE_WIDTH}">
<meta property="og:image:height" content="${IMAGE_HEIGHT}">
<meta property="og:image:alt" content="${title}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${image}">
</head>
<body><a href="${target}">Open the wall</a></body>
</html>
`;
}

/**
 * Fetches a cover, giving up after a few seconds or a few megabytes.
 *
 * @returns The image bytes, or `null` when it could not be fetched.
 */
async function fetchCover(url: string): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "AlbumWall/1.0 (+https://bradleygolski.com/album-wall/)" },
      signal: AbortSignal.timeout(COVER_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    return bytes.length > 0 && bytes.length <= MAX_COVER_BYTES ? bytes : null;
  } catch {
    return null;
  }
}

/** Runs `task` over `items`, at most `limit` at a time, keeping the order. */
async function mapLimited<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Where each cover goes in the preview image: the wall's grid, as large as fits, centred.
 *
 * @returns Cover size, gap, corner radius and the grid's top-left corner.
 */
export function layoutWall(rows: number, columns: number) {
  const width = IMAGE_WIDTH - 2 * IMAGE_PADDING;
  const height = IMAGE_HEIGHT - 2 * IMAGE_PADDING;
  const size = Math.floor(
    Math.min(
      width / (columns + (columns - 1) * GAP_RATIO),
      height / (rows + (rows - 1) * GAP_RATIO)
    )
  );
  const gap = Math.round(size * GAP_RATIO);
  const gridWidth = columns * size + (columns - 1) * gap;
  const gridHeight = rows * size + (rows - 1) * gap;
  return {
    size,
    gap,
    radius: Math.round(size * RADIUS_RATIO),
    left: Math.floor((IMAGE_WIDTH - gridWidth) / 2),
    top: Math.floor((IMAGE_HEIGHT - gridHeight) / 2),
  };
}

function roundedSquare(size: number, radius: number, fill: string) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="${fill}"/></svg>`
  );
}

/**
 * Draws the wall as a 1200 x 630 JPEG: each cover in its place with rounded corners, a plain
 * tile where a cover could not be fetched.
 *
 * @param wall Rows, columns and cover addresses in wall order.
 * @param loadCover Fetches one cover (replaceable in tests).
 */
export async function drawWallImage(
  wall: Pick<SharedWall, "rows" | "columns" | "covers">,
  loadCover: (url: string) => Promise<Buffer | null> = fetchCover
): Promise<Buffer> {
  const rows = Math.max(1, Math.min(20, Math.floor(wall.rows)));
  const columns = Math.max(1, Math.min(20, Math.floor(wall.columns)));
  const { size, gap, radius, left, top } = layoutWall(rows, columns);
  const covers = wall.covers.slice(0, rows * columns);
  const mask = roundedSquare(size, radius, "#fff");
  const placeholder = roundedSquare(size, radius, PLACEHOLDER);

  const tiles = await mapLimited(covers, COVER_CONCURRENCY, async (url) => {
    const bytes = await loadCover(url);
    if (!bytes) return placeholder;
    try {
      return await sharp(bytes)
        .resize(size, size, { fit: "cover" })
        .composite([{ input: mask, blend: "dest-in" }])
        .png()
        .toBuffer();
    } catch {
      return placeholder;
    }
  });

  return sharp({
    create: { width: IMAGE_WIDTH, height: IMAGE_HEIGHT, channels: 3, background: BACKGROUND },
  })
    .composite(
      tiles.map((input, index) => ({
        input,
        left: left + (index % columns) * (size + gap),
        top: top + Math.floor(index / columns) * (size + gap),
      }))
    )
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

/**
 * Short share links: `/w/<id>` sends people to the app with the wall in the address and gives
 * link preview fetchers a page with the wall's picture; `/w/<id>.jpg` is that picture.
 *
 * @param event Function URL request (through CloudFront).
 * @returns A redirect, the preview page or the image.
 */
export async function handler(event: FunctionUrlEvent): Promise<ShareResponse> {
  const match = SHARE_ID.exec(event.rawPath ?? "/");
  if (!match) return redirect(defaultApp(), "public, max-age=3600");

  const [, id, isImage] = match;
  const wall = await getSharedWall(id!);
  if (!wall) {
    return isImage
      ? redirect(`${defaultApp()}og-image.jpg`, "public, max-age=300")
      : redirect(defaultApp(), "no-store");
  }

  if (isImage) {
    try {
      const image = await drawWallImage(wall);
      return {
        statusCode: 200,
        headers: {
          "content-type": "image/jpeg",
          "cache-control": "public, max-age=31536000, immutable",
        },
        body: image.toString("base64"),
        isBase64Encoded: true,
      };
    } catch (error) {
      console.error("Could not draw the wall image:", error);
      return redirect(`${defaultApp()}og-image.jpg`, "public, max-age=300");
    }
  }

  const userAgent = event.headers?.["user-agent"] ?? "";
  if (!PREVIEW_FETCHERS.test(userAgent)) {
    return redirect(`${wall.app}#share=${wall.payload}`, "no-store");
  }

  const pageUrl = `https://${await getShareDomain()}/w/${id}`;
  return {
    statusCode: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    body: previewPage(wall, pageUrl),
  };
}
