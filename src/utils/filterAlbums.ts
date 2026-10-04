import { Album } from "@/types";

/**
 * Lowercases text and strips accents so "Beyoncé" matches "beyonce".
 *
 * @param text Text to normalize.
 * @returns The normalized text.
 */
function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * Filters albums by a search query. The query is split into words, and an album matches when
 * every word appears in its title, artist, year or any of its genres, ignoring case and accents.
 *
 * @param albums Albums to search.
 * @param query Text typed by the user.
 * @returns The matching albums in their original order; the same array when the query is blank.
 */
export function filterAlbums(albums: Album[], query: string): Album[] {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return albums;

  return albums.filter((album) => {
    const searchable = normalize(
      [album.title, album.artist, album.year, ...(album.genre ?? [])].filter(Boolean).join(" ")
    );
    return words.every((word) => searchable.includes(word));
  });
}
