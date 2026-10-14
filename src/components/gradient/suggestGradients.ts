import type { Album } from "@/types";
import type { CoverProfile } from "@/utils/coverProfile";
import type { CoverColor } from "@/utils/colorBasics";
import { oklabToHex } from "@/utils/gradientTargets";
import { namedMainColors } from "@/utils/colorName";
import { buildGradientWall, type WallGradient } from "./buildGradientWall";

/** A gradient suggested from what is in the collection. */
export interface SuggestedGradient extends WallGradient {
  /** Plain names of its colors, first to last, such as ["black", "red", "white"]. */
  names: string[];
}

const NEUTRALS = new Set(["black", "gray", "white"]);
const COLORFUL_SUGGESTIONS = 3;

interface Family {
  name: string;
  color: CoverColor;
  count: number;
}

function median(colors: CoverColor[]): CoverColor {
  const middle = (key: keyof CoverColor) =>
    colors.map((color) => color[key]).sort((x, y) => x - y)[Math.floor(colors.length / 2)]!;
  return { l: middle("l"), a: middle("a"), b: middle("b") };
}

/**
 * The color families in a collection: for each everyday color name, how many covers have it as one
 * of their main colors, and the typical (median) shade of it on those covers.
 *
 * @param albums The collection.
 * @param profiles Measured covers by album id.
 * @returns Families, most common first.
 */
export function colorFamilies(
  albums: Album[],
  profiles: Readonly<Record<string, CoverProfile | null | undefined>>
): Family[] {
  const shades = new Map<string, CoverColor[]>();
  for (const album of albums) {
    const profile = profiles[String(album.id)];
    if (!profile) continue;
    for (const { name, color } of namedMainColors(profile)) {
      shades.set(name, [...(shades.get(name) ?? []), color]);
    }
  }
  return [...shades.entries()]
    .map(([name, colors]) => ({ name, color: median(colors), count: colors.length }))
    .sort((x, y) => y.count - x.count || x.name.localeCompare(y.name));
}

const plural = (name: string) => `${name}s`;
const list = (names: string[]) =>
  names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/**
 * One sentence about what colors the collection has, so the suggestions make sense.
 *
 * @param families The collection's color families.
 * @param enough How many covers a family needs to fill its part of the wall.
 * @returns For example "Mostly black, gray and white covers, with some reds and browns."
 */
export function describeCollection(families: Family[], enough: number): string {
  if (families.length === 0) return "";
  const mostly = families.slice(0, 3).map((family) => family.name);
  const some = families
    .slice(3)
    .filter((family) => family.count >= enough && !NEUTRALS.has(family.name))
    .map((family) => plural(family.name));
  const colorfulInMostly = mostly.some((name) => !NEUTRALS.has(name));
  const tail =
    some.length > 0
      ? `, with some ${list(some)}`
      : colorfulInMostly
        ? ""
        : ", with few strongly colored ones";
  return `Mostly ${list(mostly)} covers${tail}.`;
}

/**
 * Gradients this collection can fill well, made from the shades its covers really have: one that
 * runs from dark to light through neutrals, then up to three that include a color other than brown, each a
 * different set of colors, best fitting first. A color is only used when enough covers have it to
 * fill its part of the wall at this size. Stops run from darkest to lightest.
 *
 * @param input.albums The collection.
 * @param input.profiles Measured covers by album id.
 * @param input.rows Wall rows.
 * @param input.columns Wall columns.
 * @returns The suggestions and a sentence describing the collection's colors.
 */
export function suggestGradients(input: {
  albums: Album[];
  profiles: Readonly<Record<string, CoverProfile | null | undefined>>;
  rows: number;
  columns: number;
}): { suggestions: SuggestedGradient[]; summary: string } {
  const { albums, profiles, rows, columns } = input;
  const spots = Math.min(rows * columns, albums.length);
  const families = colorFamilies(albums, profiles);
  // Each stop of a three-color gradient covers about a third of the wall.
  const enough = Math.max(1, Math.ceil(spots / 3));
  const summary = describeCollection(families, enough);
  const usable = families.filter((family) => family.count >= enough);

  const candidates: Family[][] = [];
  for (let i = 0; i < usable.length; i += 1) {
    for (let j = i + 1; j < usable.length; j += 1) {
      candidates.push([usable[i]!, usable[j]!]);
      for (let k = j + 1; k < usable.length; k += 1) {
        candidates.push([usable[i]!, usable[j]!, usable[k]!]);
      }
    }
  }

  const scored = candidates.map((stops) => {
    const ordered = [...stops].sort((x, y) => x.color.l - y.color.l);
    const gradient = { colors: ordered.map((family) => oklabToHex(family.color)), angle: 90 };
    const { meanFit } = buildGradientWall({
      albums,
      rows,
      columns,
      pinned: new Set(),
      profiles,
      gradient,
      keepArtistsApart: false,
      quick: true,
    });
    return { ...gradient, names: ordered.map((family) => family.name), meanFit };
  });
  scored.sort((x, y) => x.meanFit - y.meanFit);

  const neutral = scored.find((item) => item.names.every((name) => NEUTRALS.has(name)));
  const colorful: typeof scored = [];
  const usedColors = new Set<string>();
  for (const item of scored) {
    if (colorful.length >= COLORFUL_SUGGESTIONS) break;
    const colors = item.names.filter((name) => !NEUTRALS.has(name));
    // Brown on its own reads as another neutral, so a colorful suggestion needs a real color.
    if (!colors.some((name) => name !== "brown")) continue;
    const key = [...colors].sort().join("+");
    if (usedColors.has(key)) continue;
    usedColors.add(key);
    colorful.push(item);
  }

  const suggestions = [...(neutral ? [neutral] : []), ...colorful].map(
    ({ colors, angle, names }) => ({ colors, angle, names })
  );
  return { suggestions, summary };
}
