/**
 * Sorts a list of albums by the color of their covers.
 *
 * The sort groups albums into three categories in this order:
 * 1. Colorful covers (chroma >= NEUTRAL_CHROMA). These are sorted by an adjusted hue
 *    that starts at 20° and wraps around, and then by lightness (l) descending.
 * 2. Neutral covers (chroma < NEUTRAL_CHROMA). These are sorted by lightness descending.
 * 3. Albums with no color information. They retain their original order.
 *
 * The comparison is stable: albums that compare equal keep the same relative order as
 * in the input list. The function never mutates the input array.
 */
import type { Album } from "@/types";
import type { CoverColor } from "./colorBasics";
import { chromaOf, hueOf, NEUTRAL_CHROMA } from "./colorBasics";

export function sortAlbumsByColor(
  albums: Album[],
  colors: Record<string, CoverColor | null>,
  getKey: (album: Album) => string
): Album[] {
  // Decorate albums with index and resolved color.
  const decorated = albums.map((album, idx) => ({
    album,
    idx,
    color: colors[getKey(album)],
  }));

  const colorful: Array<(typeof decorated)[0]> = [];
  const neutral: Array<(typeof decorated)[0]> = [];
  const missing: Array<(typeof decorated)[0]> = [];

  for (const item of decorated) {
    const c = item.color;
    if (!c) {
      missing.push(item);
    } else if (chromaOf(c) >= NEUTRAL_CHROMA) {
      colorful.push(item);
    } else {
      neutral.push(item);
    }
  }

  const sortColorful = (a: (typeof decorated)[0], b: (typeof decorated)[0]) => {
    const hueA = (hueOf(a.color!) - 20 + 360) % 360;
    const hueB = (hueOf(b.color!) - 20 + 360) % 360;
    if (hueA !== hueB) return hueA - hueB;
    if (a.color!.l !== b.color!.l) return b.color!.l - a.color!.l; // descending lightness
    return a.idx - b.idx;
  };

  const sortNeutral = (a: (typeof decorated)[0], b: (typeof decorated)[0]) => {
    if (a.color!.l !== b.color!.l) return b.color!.l - a.color!.l; // descending lightness
    return a.idx - b.idx;
  };

  colorful.sort(sortColorful);
  neutral.sort(sortNeutral);
  // missing order preserved, no sort needed

  const sorted = [...colorful, ...neutral, ...missing].map((x) => x.album);
  return sorted;
}
