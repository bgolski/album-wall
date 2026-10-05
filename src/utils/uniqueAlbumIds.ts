import { Album } from "@/types";

/**
 * Assigns unique IDs to duplicate copies of the same release.
 *
 * The function iterates over the provided album array and keeps track of how many
 * copies of each `id` have been seen. The first album with a given id is
 * returned as‑is. Subsequent copies receive a new id calculated as
 * `-(originalId * 100 + n)`, where `n` is the number of prior copies (starting at 1).
 *
 * The input array is never mutated; the output contains the original album
 * objects for the first copies and shallow copies with updated ids for later
 * duplicates.
 *
 * @param albums Array of albums to process.
 * @returns A new array with unique ids for duplicate copies.
 */
export function giveCopiesUniqueIds(albums: Album[]): Album[] {
  const seen = new Map<number, number>();
  const result: Album[] = [];
  for (const album of albums) {
    const count = seen.get(album.id) ?? 0;
    if (count === 0) {
      result.push(album);
    } else {
      const newId = -(album.id * 100 + count);
      result.push({ ...album, id: newId });
    }
    seen.set(album.id, count + 1);
  }
  return result;
}
