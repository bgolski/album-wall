import { chromaOf, hueOf, NEUTRAL_CHROMA, type CoverColor } from "./colorBasics";
import type { CoverProfile, PaletteEntry } from "./coverProfile";

/** Palette colors covering less of a cover than this are details (a logo, a sticker), not one of its colors. */
export const MAIN_COLOR_SHARE = 0.15;
// Muted warm colors below this colorfulness read as brown or tan rather than orange or yellow.
const BROWN_CHROMA = 0.09;

/**
 * The everyday name of a color, the way people describe album covers.
 *
 * @param color A color in OKLab.
 * @returns One of black, gray, white, brown, red, pink, orange, yellow, green, blue or purple.
 */
export function colorName(color: CoverColor): string {
  const chroma = chromaOf(color);
  const hue = hueOf(color);
  if (chroma < NEUTRAL_CHROMA) return color.l < 0.4 ? "black" : color.l > 0.82 ? "white" : "gray";
  if (hue >= 30 && hue < 95 && chroma < BROWN_CHROMA) return "brown";
  if (hue >= 345 || hue < 15) return color.l >= 0.65 ? "pink" : "red";
  if (hue < 45) return "red";
  if (hue < 80) return "orange";
  if (hue < 125) return "yellow";
  if (hue < 180) return "green";
  if (hue < 270) return "blue";
  if (hue < 320) return "purple";
  return "pink";
}

/**
 * A cover's main colors: the palette colors covering at least {@link MAIN_COLOR_SHARE} of it,
 * biggest first, or just the biggest when none does.
 *
 * @param profile The cover's measured profile.
 * @returns Palette entries.
 */
export function mainColors(profile: CoverProfile): PaletteEntry[] {
  const sorted = [...profile.palette].sort((x, y) => y.share - x.share);
  const main = sorted.filter((entry) => entry.share >= MAIN_COLOR_SHARE);
  return main.length > 0 ? main : sorted.slice(0, 1);
}

/**
 * A cover's main colors as people name them: shades with the same name count as one color, with
 * their shares added (the biggest shade stands for it), biggest first, keeping those covering at
 * least {@link MAIN_COLOR_SHARE}, or just the biggest when none does.
 *
 * @param profile The cover's measured profile.
 * @returns Named colors, such as pink 55% and black 41%.
 */
export function namedMainColors(profile: CoverProfile): (PaletteEntry & { name: string })[] {
  const named = new Map<string, PaletteEntry & { name: string; biggest: number }>();
  for (const entry of profile.palette) {
    const name = colorName(entry.color);
    const known = named.get(name);
    if (!known) {
      named.set(name, { ...entry, name, biggest: entry.share });
      continue;
    }
    known.share += entry.share;
    if (entry.share > known.biggest) {
      known.color = entry.color;
      known.biggest = entry.share;
    }
  }
  const sorted = [...named.values()]
    .sort((x, y) => y.share - x.share)
    .map(({ name, color, share }) => ({ name, color, share }));
  const main = sorted.filter((entry) => entry.share >= MAIN_COLOR_SHARE);
  return main.length > 0 ? main : sorted.slice(0, 1);
}

/**
 * The names of a cover's main colors, biggest first.
 *
 * @param profile The cover's measured profile.
 * @returns Names such as ["pink", "black"].
 */
export function mainColorNames(profile: CoverProfile): string[] {
  return namedMainColors(profile).map((entry) => entry.name);
}
