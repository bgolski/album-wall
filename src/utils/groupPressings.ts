import type { Album } from "@/types";
import { albumKey } from "./albumKey";

// Words that mark an edition of an album rather than a different album, when they appear in
// brackets or after a dash: "Abbey Road (Remastered)", "Rumours - Deluxe Edition".
const EDITION_WORDS =
  /\b(deluxe|remaster(ed)?|\d+(st|nd|rd|th) anniversary|anniversary|edition|expanded|reissue|re-issue|bonus|special|limited|collector'?s|super|version|mono|stereo|\d+\s*g(ram)?|vinyl|lp|\d+\s*lp|picture disc|colou?red|clean|explicit|\d{4})\b/i;

function plain(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * An album's title without edition wording: bracketed parts or a dash-separated tail are dropped
 * when they name an edition (deluxe, remastered, anniversary, 180g, a year...), never otherwise,
 * so "Led Zeppelin II" and "Rumours Live" stay distinct.
 *
 * @param title Title as Discogs lists it.
 * @returns The title in plain lowercase words.
 */
export function baseTitle(title: string): string {
  let text = title.replace(/[([{][^)\]}]*[)\]}]/g, (part: string) => {
    const inner = part.slice(1, -1);
    return EDITION_WORDS.test(inner) ? " " : ` ${inner} `;
  });
  const dash = text.search(/\s[-–—]\s/);
  if (dash !== -1 && EDITION_WORDS.test(text.slice(dash))) text = text.slice(0, dash);
  return plain(text);
}

/**
 * An artist name for matching: without Discogs' "(2)" numbering or a leading "The".
 *
 * @param artist Artist as Discogs lists it.
 * @returns The name in plain lowercase words.
 */
export function baseArtist(artist: string): string {
  return plain(artist.replace(/\s*\(\d+\)\s*$/, "")).replace(/^the /, "");
}

/**
 * What pressings of one album share: their Discogs master release when Discogs has one, which
 * tells apart albums that share a title (several self-titled albums by one artist); otherwise
 * the artist and the title without edition wording.
 *
 * @param album An album.
 * @returns A key equal for pressings of the same album.
 */
export function pressingKey(album: Album): string {
  if (album.masterId) return `master:${album.masterId}`;
  return `${baseArtist(album.artist ?? "")}|${baseTitle(album.title ?? "")}`;
}

/**
 * Shows each album once: of each set of pressings, one stands for the album (the one chosen, or
 * the first in the current order) and the others are set aside.
 *
 * @param albums The collection in its current order.
 * @param chosen Album id chosen to stand for each pressing key.
 * @returns The albums shown (in order), the ones set aside, and the sets of pressings.
 */
export function showEachAlbumOnce(
  albums: Album[],
  chosen: Readonly<Record<string, string>> = {}
): { shown: Album[]; hidden: Album[]; groups: Album[][] } {
  const groups = new Map<string, Album[]>();
  for (const album of albums) {
    const key = pressingKey(album);
    groups.set(key, [...(groups.get(key) ?? []), album]);
  }
  const standing = new Map<string, string>();
  for (const [key, pressings] of groups) {
    const pick = pressings.find((album) => albumKey(album) === chosen[key]) ?? pressings[0]!;
    standing.set(key, albumKey(pick));
  }
  const shown: Album[] = [];
  const hidden: Album[] = [];
  for (const album of albums) {
    (standing.get(pressingKey(album)) === albumKey(album) ? shown : hidden).push(album);
  }
  return { shown, hidden, groups: [...groups.values()].filter((set) => set.length > 1) };
}
