import {
  BatchGetItemCommand,
  DynamoDBClient,
  PutItemCommand,
  type AttributeValue,
} from "@aws-sdk/client-dynamodb";
import sharp from "sharp";
import { packProfile, type PackedProfile } from "../../../src/utils/colorCache";
import { coverProfile } from "../../../src/utils/coverProfile";
import { allowedCoverUrl, fetchCover, resizeCover } from "../cover-image/index";
import { type FunctionUrlEvent, jsonResponse, readBody } from "../shared/http";

// Cover colors are the same for everyone, so they are measured once here and kept: the app asks
// for a batch of covers, gets what is kept, and what is missing (up to a few per request) is
// measured from the cover itself the way the browser would. Only this function writes.

/** Most covers one request may ask about; DynamoDB reads a batch of this size at once. */
export const MAX_URLS = 100;
const MAX_BODY_BYTES = 40_000;
/** Covers measured per request; the rest are left for the browser, or the next request. */
export const MEASURE_LIMIT = 8;
const MEASURE_CONCURRENCY = 4;
/** Side of the small copy that is measured, as in the browser. */
const SAMPLE_SIZE = 64;
/** How long a profile is kept after it was measured (DynamoDB expires it for free). */
const KEEP_SECONDS = 365 * 24 * 60 * 60;
/** Bumped when profiles measured earlier should be measured again. */
export const PROFILE_VERSION = 1;

type ProfileResponse = { statusCode: number; headers: Record<string, string>; body: string };

/** What the handler needs from the outside, so it can be tested without AWS or the network. */
export interface ProfileStore {
  /** Profiles already kept, by cover address. */
  read(urls: string[]): Promise<Map<string, PackedProfile>>;
  /** Measures one cover; `null` when it cannot be loaded or has no opaque pixels. */
  measure(url: URL): Promise<PackedProfile | null>;
  /** Keeps a measured profile. */
  save(url: string, profile: PackedProfile): Promise<void>;
}

const respond = (statusCode: number, body: unknown): ProfileResponse =>
  jsonResponse(statusCode, body);

/**
 * Reads the cover addresses from a request body: a JSON object with a `urls` list of allowed
 * covers, ignoring any that are not allowed.
 *
 * @param event The request.
 * @returns The distinct allowed addresses, or an error message.
 */
export function parseUrls(event: FunctionUrlEvent): URL[] | string {
  const raw = readBody(event);
  if (raw.length > MAX_BODY_BYTES) return "That request is too large.";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return "Send a JSON body with a list of cover addresses.";
  }
  const urls = (parsed as { urls?: unknown } | null)?.urls;
  if (!Array.isArray(urls) || urls.length > MAX_URLS) {
    return `Send between 0 and ${MAX_URLS} cover addresses.`;
  }
  const allowed = new Map<string, URL>();
  for (const value of urls) {
    const url = typeof value === "string" ? allowedCoverUrl(value) : null;
    if (url) allowed.set(url.href, url);
  }
  return [...allowed.values()];
}

/**
 * Builds the handler for the profile service.
 *
 * @param store Reading, measuring and keeping profiles.
 * @returns A function URL handler for `POST` with `{ urls: [...] }`, answering
 *          `{ profiles: { [address]: packed profile } }` for the covers it has or could measure.
 */
export const createHandler = (store: ProfileStore) =>
  async function handler(event: FunctionUrlEvent): Promise<ProfileResponse> {
    if ((event.requestContext?.http?.method ?? "POST") !== "POST") {
      return respond(405, { error: "Method not allowed." });
    }
    const urls = parseUrls(event);
    if (typeof urls === "string") return respond(400, { error: urls });

    const profiles: Record<string, PackedProfile> = {};
    const kept = await store.read(urls.map((url) => url.href));
    for (const [href, profile] of kept) profiles[href] = profile;

    const missing = urls.filter((url) => !(url.href in profiles)).slice(0, MEASURE_LIMIT);
    let next = 0;
    const worker = async () => {
      while (next < missing.length) {
        const url = missing[next++]!;
        const profile = await store.measure(url).catch(() => null);
        if (!profile) continue;
        profiles[url.href] = profile;
        await store.save(url.href, profile).catch(() => undefined);
      }
    };
    await Promise.all(Array.from({ length: MEASURE_CONCURRENCY }, worker));
    return respond(200, { profiles });
  };

/**
 * Works out a cover's profile as the browser does: from a 64-pixel copy made the way the app's
 * image service makes it, with the same code.
 *
 * @param source The cover's bytes as the host serves them.
 * @returns The packed profile, or `null` when the cover has no opaque pixels.
 */
export async function profileOfCover(source: Buffer): Promise<PackedProfile | null> {
  const copy = await resizeCover(source, SAMPLE_SIZE);
  const { data } = await sharp(copy)
    .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const profile = coverProfile(
    new Uint8ClampedArray(data.buffer, data.byteOffset, data.length),
    SAMPLE_SIZE,
    SAMPLE_SIZE
  );
  return profile ? packProfile(profile) : null;
}

async function measureCover(url: URL): Promise<PackedProfile | null> {
  return profileOfCover(await fetchCover(url));
}

function dynamoStore(): ProfileStore {
  const table = process.env.PROFILE_TABLE_NAME;
  const client = new DynamoDBClient({});
  return {
    async read(urls) {
      const found = new Map<string, PackedProfile>();
      if (!table || urls.length === 0) return found;
      try {
        const output = await client.send(
          new BatchGetItemCommand({
            RequestItems: { [table]: { Keys: urls.map((url) => ({ url: { S: url } })) } },
          })
        );
        for (const item of output.Responses?.[table] ?? []) {
          const text = item.profile?.S;
          const version = Number(item.v?.N ?? 0);
          if (!item.url?.S || !text || version < PROFILE_VERSION) continue;
          try {
            found.set(item.url.S, JSON.parse(text) as PackedProfile);
          } catch {
            // A damaged item is measured again.
          }
        }
      } catch (error) {
        // Throttled or unavailable: the browser measures what it does not get back.
        console.error("Reading profiles failed:", (error as Error).name);
      }
      return found;
    },
    measure: measureCover,
    async save(url, profile) {
      if (!table) return;
      const item: Record<string, AttributeValue> = {
        url: { S: url },
        profile: { S: JSON.stringify(profile) },
        v: { N: String(PROFILE_VERSION) },
        ttl: { N: String(Math.floor(Date.now() / 1000) + KEEP_SECONDS) },
      };
      await client.send(new PutItemCommand({ TableName: table, Item: item }));
    },
  };
}

export const handler = createHandler(dynamoStore());
