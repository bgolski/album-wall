import { Album } from "../types";

/**
 * Parse a demo collection envelope received from the demo fixture.
 *
 * The envelope must be an object with `v: 1` and an `albums` array.
 * Each album must have a unique, positive safe‑integer `id`, a non‑empty
 * trimmed `title`, and a non‑empty trimmed `artist`.  Optional fields
 * (e.g. `cover_image`, `genre`) are preserved.  The first record for a
 * duplicate `id` is kept.
 *
 * The function never mutates the input and returns `null` for an
 * invalid envelope or when no valid albums remain.
 *
 * @param value The raw envelope value.
 * @returns An array of `Album` objects or `null`.
 */
export function parseDemoCollection(value: unknown): Album[] | null {
  // Validate envelope
  if (typeof value !== "object" || value === null) return null;
  const obj = value as Record<string, unknown>;
  if (obj.v !== 1) return null;
  const albums = obj.albums;
  if (!Array.isArray(albums)) return null;

  const seen = new Set<number>();
  const result: Album[] = [];

  for (const record of albums) {
    if (typeof record !== "object" || record === null) continue;
    const rec = record as Record<string, unknown>;
    const idVal = rec.id;
    const titleVal = rec.title;
    const artistVal = rec.artist;

    const id = typeof idVal === "number" ? idVal : null;
    const title = typeof titleVal === "string" ? titleVal.trim() : "";
    const artist = typeof artistVal === "string" ? artistVal.trim() : "";

    if (
      typeof id === "number" &&
      Number.isInteger(id) &&
      id > 0 &&
      id <= Number.MAX_SAFE_INTEGER &&
      title.length > 0 &&
      artist.length > 0 &&
      !seen.has(id)
    ) {
      seen.add(id);
      const album: Album = {
        ...rec,
        id,
        title,
        artist,
      } as Album;
      result.push(album);
    }
  }

  return result.length ? result : null;
}

/**
 * Name the demo wall is saved and shared under. The tilde is not allowed in a Discogs username,
 * so it can never match a real account's saved wall or share link.
 */
export const DEMO_USERNAME = "~demo";

/**
 * Returns the name to show people for a wall: the demo reads "Demo", anyone else is unchanged.
 *
 * @param username Username the wall is saved under.
 * @returns Name for headings, share text and file names.
 */
export function wallDisplayName(username: string): string {
  return username === DEMO_USERNAME ? "Demo" : username;
}
