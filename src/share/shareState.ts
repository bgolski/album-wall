import { Album, SharedWallState } from "@/types/index";
import { albumKey } from "@/wall/albumKey";

const SHARE_HASH_KEY = "share";

interface BuildSharedWallStateParams {
  username: string;
  rows: number;
  columns: number;
  wallAlbumIds: string[];
  pinnedAlbumIds: string[];
}

/**
 * Builds the serializable wall state payload used for shareable hash links.
 *
 * @param params Current wall state fields to persist in the share link.
 */
export function buildSharedWallState({
  username,
  rows,
  columns,
  wallAlbumIds,
  pinnedAlbumIds,
}: BuildSharedWallStateParams): SharedWallState {
  return {
    v: 1,
    username,
    rows,
    columns,
    wallAlbumIds,
    pinnedAlbumIds,
  };
}

// First byte of a compact payload. A JSON payload always starts with "{", so the two never clash.
const COMPACT_FORMAT = 2;

function bytesToBase64Url(bytes: Uint8Array): string {
  if (typeof window === "undefined") {
    return Buffer.from(bytes).toString("base64url");
  }

  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  if (typeof window === "undefined") {
    return new Uint8Array(Buffer.from(value, "base64url"));
  }

  const paddedValue = value.replace(/-/g, "+").replace(/_/g, "/");
  const normalizedValue = paddedValue + "=".repeat((4 - (paddedValue.length % 4 || 4)) % 4);
  return Uint8Array.from(atob(normalizedValue), (char) => char.charCodeAt(0));
}

/** Appends a non-negative integer seven bits at a time, low bits first (LEB128). */
function writeVarint(out: number[], value: number) {
  let rest = value;
  while (rest >= 0x80) {
    out.push((rest % 0x80) | 0x80);
    rest = Math.floor(rest / 0x80);
  }
  out.push(rest);
}

function readVarint(bytes: Uint8Array, cursor: { at: number }): number {
  let value = 0;
  let factor = 1;
  for (;;) {
    if (cursor.at >= bytes.length || factor > Number.MAX_SAFE_INTEGER) {
      throw new Error("Truncated share payload");
    }
    const byte = bytes[cursor.at++]!;
    value += (byte & 0x7f) * factor;
    if (byte < 0x80) return value;
    factor *= 0x80;
  }
}

const isWholeNumber = (id: string) =>
  /^(0|[1-9]\d{0,15})$/.test(id) && Number(id) <= Number.MAX_SAFE_INTEGER;

/**
 * Writes a wall as bytes: format, rows, columns, collection name, each album id as a variable
 * length number, then the pinned albums as positions on the wall. About a third of the JSON size.
 *
 * @returns The bytes, or `null` when the wall has something only JSON can carry (an id that is
 *   not a whole number, or a pin that is not on the wall).
 */
function toCompactBytes(state: SharedWallState): Uint8Array | null {
  if (!state.wallAlbumIds.every(isWholeNumber)) return null;
  const positions = state.pinnedAlbumIds.map((id) => state.wallAlbumIds.indexOf(id));
  if (positions.some((position) => position < 0)) return null;

  const out: number[] = [COMPACT_FORMAT];
  writeVarint(out, state.rows);
  writeVarint(out, state.columns);
  const name = new TextEncoder().encode(state.username);
  writeVarint(out, name.length);
  out.push(...name);
  writeVarint(out, state.wallAlbumIds.length);
  for (const id of state.wallAlbumIds) writeVarint(out, Number(id));
  writeVarint(out, positions.length);
  for (const position of positions) writeVarint(out, position);
  return Uint8Array.from(out);
}

function fromCompactBytes(bytes: Uint8Array): SharedWallState | null {
  const cursor = { at: 1 };
  const rows = readVarint(bytes, cursor);
  const columns = readVarint(bytes, cursor);
  const nameLength = readVarint(bytes, cursor);
  if (cursor.at + nameLength > bytes.length) return null;
  const username = new TextDecoder("utf-8", { fatal: true }).decode(
    bytes.subarray(cursor.at, cursor.at + nameLength)
  );
  cursor.at += nameLength;
  const wallAlbumIds = Array.from({ length: readVarint(bytes, cursor) }, () =>
    String(readVarint(bytes, cursor))
  );
  const pinnedAlbumIds = Array.from({ length: readVarint(bytes, cursor) }, () => {
    const id = wallAlbumIds[readVarint(bytes, cursor)];
    if (id === undefined) throw new Error("Pin outside the wall");
    return id;
  });
  if (cursor.at !== bytes.length) return null;
  return { v: 1, username, rows, columns, wallAlbumIds, pinnedAlbumIds };
}

/**
 * Encodes shared wall state into a URL-safe hash payload, compactly when it can.
 */
export function encodeSharedWallState(state: SharedWallState): string {
  const compact = toCompactBytes(state);
  return bytesToBase64Url(compact ?? new TextEncoder().encode(JSON.stringify(state)));
}

/**
 * Decodes and validates a shared wall state payload from a hash string. Reads both the compact
 * format and the JSON one earlier links used.
 *
 * @returns Parsed shared wall state when valid, otherwise `null`.
 */
export function decodeSharedWallState(encodedState: string): SharedWallState | null {
  try {
    const bytes = base64UrlToBytes(encodedState);
    if (bytes[0] === COMPACT_FORMAT) return fromCompactBytes(bytes);

    const parsedState = JSON.parse(new TextDecoder().decode(bytes)) as Partial<SharedWallState>;

    if (
      parsedState.v !== 1 ||
      typeof parsedState.username !== "string" ||
      typeof parsedState.rows !== "number" ||
      typeof parsedState.columns !== "number" ||
      !Array.isArray(parsedState.wallAlbumIds) ||
      !Array.isArray(parsedState.pinnedAlbumIds)
    ) {
      return null;
    }

    return {
      v: 1,
      username: parsedState.username,
      rows: parsedState.rows,
      columns: parsedState.columns,
      wallAlbumIds: parsedState.wallAlbumIds.map(String),
      pinnedAlbumIds: parsedState.pinnedAlbumIds.map(String),
    };
  } catch {
    return null;
  }
}

/**
 * Builds the hash fragment for a shareable wall link.
 */
export function buildShareHash(encodedState: string): string {
  return `#${SHARE_HASH_KEY}=${encodedState}`;
}

/**
 * Extracts an encoded shared wall payload from a location hash.
 *
 * @returns Encoded share payload when present, otherwise `null`.
 */
export function getEncodedSharedWallStateFromHash(hash: string): string | null {
  const normalizedHash = hash.startsWith("#") ? hash.slice(1) : hash;
  const searchParams = new URLSearchParams(normalizedHash);
  return searchParams.get(SHARE_HASH_KEY);
}

/**
 * Parses shared wall state from a location hash.
 *
 * @returns Parsed shared wall state when present and valid, otherwise `null`.
 */
export function getSharedWallStateFromHash(hash: string): SharedWallState | null {
  const encodedState = getEncodedSharedWallStateFromHash(hash);
  return encodedState ? decodeSharedWallState(encodedState) : null;
}

/**
 * Builds a full share URL by replacing the current location hash.
 *
 * @param state Shared wall state to encode into the URL.
 * @returns Absolute share URL containing the encoded wall state in the hash.
 */
export function buildSharedWallUrl(state: SharedWallState, currentUrl: string): string {
  const url = new URL(currentUrl);
  url.hash = buildShareHash(encodeSharedWallState(state));
  return url.toString();
}

/**
 * Puts a loaded collection in the order a shared wall link describes: the shared wall albums
 * first, in the shared order (any no longer in the collection are skipped), then the rest in
 * their own order.
 *
 * @returns The collection with the shared wall at the front.
 */
export function orderAlbumsBySharedWall(
  albums: Album[],
  sharedWallState: SharedWallState
): Album[] {
  const albumMap = new Map(albums.map((album) => [albumKey(album), album]));
  const sharedWallAlbums = sharedWallState.wallAlbumIds
    .map((albumId) => albumMap.get(albumId))
    .filter((album): album is Album => Boolean(album));
  const sharedWallAlbumIds = new Set(sharedWallAlbums.map(albumKey));
  const remainingAlbums = albums.filter((album) => !sharedWallAlbumIds.has(albumKey(album)));

  return [...sharedWallAlbums, ...remainingAlbums];
}
