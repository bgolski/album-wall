import type { Album } from "@/types";

/**
 * The maximum age in milliseconds that a cached collection is considered valid.
 * By default this is ten minutes.
 */
export const COLLECTION_CACHE_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Reads a cached collection for a user from the supplied storage.
 *
 * The key used is `album-wall:collection:` followed by the username
 * trimmed and lower‑cased. The stored value is expected to be a JSON
 * stringified object of the form `{ v: 1, savedAt: number, albums: Album[] }`.
 *
 * Returns the albums array if the entry is present, valid, not from the
 * future, and not older than `maxAgeMs`. Otherwise returns `null`.
 */
export function readCachedCollection(
  storage: Pick<Storage, "getItem">,
  username: string,
  now: number,
  maxAgeMs = COLLECTION_CACHE_MAX_AGE_MS
): Album[] | null {
  const key = `album-wall:collection:${username.trim().toLowerCase()}`;
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const obj = data as Record<string, unknown>;
  if (obj.v !== 1) return null;
  if (typeof obj.savedAt !== "number") return null;
  if (!Array.isArray(obj.albums)) return null;
  const savedAt = obj.savedAt;
  if (savedAt > now) return null;
  if (now - savedAt > maxAgeMs) return null;
  return obj.albums as Album[];
}

/**
 * Writes a collection of albums for a user to the supplied storage.
 *
 * The key used is `album-wall:collection:` followed by the username
 * trimmed and lower‑cased. The value stored is a JSON stringified
 * object `{ v: 1, savedAt: now, albums }`.
 *
 * Returns `true` if the write succeeded, or `false` if storage threw.
 */
export function writeCachedCollection(
  storage: Pick<Storage, "setItem">,
  username: string,
  albums: Album[],
  now: number
): boolean {
  const key = `album-wall:collection:${username.trim().toLowerCase()}`;
  const value = JSON.stringify({ v: 1, savedAt: now, albums });
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
