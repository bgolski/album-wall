import { createHash } from "node:crypto";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

// Where a short link may send people back to: the live site, the home preview and local builds.
export const APP_ORIGINS = new Set([
  "https://bradleygolski.com",
  "https://bgolski.github.io",
  "https://albumwall.home.bradleygolski.com",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3100",
]);
// Covers the link preview image may fetch; anything else is drawn as a plain tile.
const COVER_HOSTS =
  /^(i\.discogs\.com|st\.discogs\.com|coverartarchive\.org|([a-z0-9-]+\.)+archive\.org)$/;
const MAX_BODY_BYTES = 32_000;
const MAX_PAYLOAD_LENGTH = 2048;
const MAX_TITLE_LENGTH = 80;
const MAX_GRID_SIDE = 20;
const MAX_URL_LENGTH = 500;
const ID_LENGTH = 8;
const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
// Shared walls are kept for a year; DynamoDB deletes them after that, free of charge.
const KEEP_SECONDS = 365 * 24 * 60 * 60;

export type ShareRequest = {
  payload: string;
  app: string;
  title: string;
  rows: number;
  columns: number;
  covers: string[];
};

export class ShareInputError extends Error {}

function isCoverUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && COVER_HOSTS.test(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Checks a share request and keeps only what the short link needs.
 *
 * @param body Request body text.
 * @returns The cleaned request.
 * @throws ShareInputError when something required is missing or not allowed.
 */
export function parseShareRequest(body: string): ShareRequest {
  if (Buffer.byteLength(body) > MAX_BODY_BYTES) throw new ShareInputError("Request too large.");
  let input: Partial<Record<keyof ShareRequest, unknown>>;
  try {
    input = JSON.parse(body) as typeof input;
  } catch {
    throw new ShareInputError("Request is not JSON.");
  }

  const { payload, app, title, rows, columns, covers } = input;
  if (
    typeof payload !== "string" ||
    payload.length === 0 ||
    payload.length > MAX_PAYLOAD_LENGTH ||
    !/^[A-Za-z0-9_-]+$/.test(payload)
  ) {
    throw new ShareInputError("Missing or invalid wall.");
  }

  let appUrl: URL;
  try {
    appUrl = new URL(String(app));
  } catch {
    throw new ShareInputError("Missing app address.");
  }
  if (!APP_ORIGINS.has(appUrl.origin)) throw new ShareInputError("App address not allowed.");

  const side = (value: unknown) =>
    Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_GRID_SIDE;
  if (!side(rows) || !side(columns)) throw new ShareInputError("Invalid wall size.");

  const coverList = Array.isArray(covers)
    ? covers.slice(0, (rows as number) * (columns as number))
    : [];
  return {
    payload,
    app: `${appUrl.origin}${appUrl.pathname}`,
    title: (typeof title === "string" && title.trim() ? title.trim() : "Album Wall").slice(
      0,
      MAX_TITLE_LENGTH
    ),
    rows: rows as number,
    columns: columns as number,
    covers: coverList.map((cover) =>
      typeof cover === "string" && cover.length <= MAX_URL_LENGTH && isCoverUrl(cover) ? cover : ""
    ),
  };
}

/**
 * A short id that is the same for the same wall, so sharing a wall twice gives one link.
 *
 * @param request The cleaned request.
 * @returns Eight base62 characters.
 */
export function shareId(request: ShareRequest): string {
  const digest = createHash("sha256").update(JSON.stringify(request)).digest();
  let id = "";
  for (let index = 0; index < ID_LENGTH; index++) id += BASE62[digest[index]! % 62];
  return id;
}

/**
 * Stores a shared wall (or refreshes its expiry when it is already stored).
 *
 * @param client DynamoDB client.
 * @param tableName Shared walls table.
 * @param request The cleaned request.
 * @param now Current time in milliseconds.
 * @returns The wall's short id.
 */
export async function storeSharedWall(
  client: DynamoDBClient,
  tableName: string,
  request: ShareRequest,
  now = Date.now()
): Promise<string> {
  const id = shareId(request);
  await client.send(
    new PutItemCommand({
      TableName: tableName,
      Item: {
        id: { S: id },
        payload: { S: request.payload },
        app: { S: request.app },
        title: { S: request.title },
        rows: { N: String(request.rows) },
        columns: { N: String(request.columns) },
        covers: { S: JSON.stringify(request.covers) },
        expires: { N: String(Math.floor(now / 1000) + KEEP_SECONDS) },
      },
    })
  );
  return id;
}
