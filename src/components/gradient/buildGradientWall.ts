import type { Album } from "@/types";
import { mainColors } from "@/utils/colorName";
import type { CoverProfile } from "@/utils/coverProfile";
import { NEUTRAL_CHROMA, chromaOf, hueOf, type CoverColor } from "@/utils/colorBasics";
import { gradientTargets, hexToOklab, type GradientStop } from "@/utils/gradientTargets";
import { regionFit, tileSamples } from "@/utils/gradientFit";
import { edgeFit } from "@/utils/neighbourFit";
import { assignByCost } from "@/utils/assignByCost";
import { arrangeGradientWall } from "@/utils/arrangeGradientWall";

/** A gradient as the panel edits it: two or more hex colors spread evenly, and a CSS angle. */
export interface WallGradient {
  colors: string[];
  angle: number;
}

// How much a seam between neighbours counts next to a cover's own fit to its spot. Kept very low:
// measured on a real collection, anything stronger swapped well-matched covers for ones with
// smoother seams and put fewer covers in the right hue, so seams only settle near-ties.
const NEIGHBOUR_WEIGHT = 0.05;
// How much lightness counts, next to hue and colorfulness, when comparing a main color with a spot.
const MAIN_COLOR_LIGHTNESS = 0.5;
// The cost given to a cover with no readable color, so it only goes up when nothing else can.
const UNMEASURED_COST = 1;
// Mean region distance (OKLab) below which a wall reads as a close match, and as a fair one.
const CLOSE_FIT = 0.09;
const FAIR_FIT = 0.16;

/**
 * Turns the panel's colors into gradient stops spread evenly from 0 to 1, skipping any that are
 * not valid hex colors.
 *
 * @param colors Hex colors, first to last.
 */
export function gradientStops(colors: string[]): GradientStop[] {
  const parsed = colors.map(hexToOklab).filter((color): color is CoverColor => color !== null);
  return parsed.map((color, index) => ({
    color,
    at: parsed.length > 1 ? index / (parsed.length - 1) : 0,
  }));
}

/**
 * The target color for each spot on a wall, row by row, for a preview strip.
 *
 * @returns One color per spot.
 */
export function wallTargets(gradient: WallGradient, rows: number, columns: number): CoverColor[] {
  return gradientTargets(gradientStops(gradient.colors), rows, columns, {
    kind: "linear",
    angle: gradient.angle,
  });
}

// Share of the collection's region lightness ignored at each end when finding its range, so one
// pure-black or pure-white cover does not set it.
const RANGE_TAIL = 0.05;
// A collection whose covers span less lightness than this is left unstretched.
const MIN_RANGE = 0.2;
// How far (degrees) a cover's hue may be from a one-color wall's hue to count as that color.
const SIMILAR_HUE = 30;

function percentile(sorted: number[], share: number) {
  return sorted[Math.floor(share * (sorted.length - 1))]!;
}

/**
 * Maps the gradient's lightness onto the range the collection actually has: almost no cover is pure
 * black or white (titles, logos and photos lighten or darken them), so without this every cover is
 * "too light" for a black gradient by about the same amount and the dark side of the wall is
 * arranged by chance. Black becomes the collection's darkest covers and white its lightest, and
 * everything between moves in proportion; hues stay as they are.
 *
 * @param samples Gradient colors, nine per spot.
 * @returns The samples with lightness mapped onto the collection's range (unchanged when the
 *          collection has almost no range to map onto).
 */
export function fitLightnessToCollection(
  samples: CoverColor[][],
  profiles: CoverProfile[]
): CoverColor[][] {
  const coverLightness = profiles
    .flatMap((profile) => profile.regions.map((region) => (region ?? profile.color).l))
    .sort((x, y) => x - y);
  if (coverLightness.length === 0) return samples;
  const low = percentile(coverLightness, RANGE_TAIL);
  const high = percentile(coverLightness, 1 - RANGE_TAIL);
  if (high - low < MIN_RANGE) return samples;
  return samples.map((tile) =>
    tile.map((color) => ({ ...color, l: low + Math.min(Math.max(color.l, 0), 1) * (high - low) }))
  );
}

/**
 * For a gradient that is one color with a clear hue, how many measured covers share that hue; for
 * anything else, null.
 *
 * @returns The count, or null.
 */
function coversOfOneColor(stops: GradientStop[], profiles: CoverProfile[]): number | null {
  const first = stops[0]?.color;
  if (!first || chromaOf(first) < NEUTRAL_CHROMA) return null;
  const hue = hueOf(first);
  const near = (color: CoverColor) => {
    const apart = Math.abs(hueOf(color) - hue) % 360;
    return chromaOf(color) >= NEUTRAL_CHROMA && Math.min(apart, 360 - apart) <= SIMILAR_HUE;
  };
  if (!stops.every((stop) => near(stop.color))) return null;
  return profiles.filter((profile) => near(profile.color)).length;
}

function averageColor(colors: CoverColor[]): CoverColor {
  const sum = colors.reduce((total, color) => ({
    l: total.l + color.l,
    a: total.a + color.a,
    b: total.b + color.b,
  }));
  return { l: sum.l / colors.length, a: sum.a / colors.length, b: sum.b / colors.length };
}

/**
 * How close a cover's nearest main color is to a spot's color, led by hue: lightness counts half,
 * so a pale pink cover still reads as pink for a pink spot.
 *
 * @returns A distance; 0 for a perfect match.
 */
export function mainColorFit(profile: CoverProfile, spot: CoverColor): number {
  const colors = mainColors(profile).map((entry) => entry.color);
  if (colors.length === 0) colors.push(profile.color);
  return Math.min(
    ...colors.map((color) =>
      Math.hypot((color.l - spot.l) * MAIN_COLOR_LIGHTNESS, color.a - spot.a, color.b - spot.b)
    )
  );
}

/**
 * Fills the wall from the whole collection with the covers that best fit a gradient: first the
 * exact best fit of each cover's 3x3 region colors to the gradient across its spot, then an
 * improvement pass that also makes neighbouring covers flow into each other in all four directions
 * and, if asked, keeps covers by the same artist from touching. Pinned covers stay where they are.
 *
 * @param input.albums The whole collection in its current order; the first `rows * columns` are
 *                     the wall.
 * @param input.profiles Cover profiles by album id; `null` or missing for a cover with no readable
 *                       color.
 * @returns The collection in its new order (wall first, then the pool in its previous order),
 *          how many same-artist pairs still touch, how many covers had no readable color, and how
 *          closely the wall matches the gradient (in words, and as the mean region distance).
 */
export function buildGradientWall(input: {
  albums: Album[];
  rows: number;
  columns: number;
  pinned: ReadonlySet<string>;
  profiles: Readonly<Record<string, CoverProfile | null | undefined>>;
  gradient: WallGradient;
  keepArtistsApart: boolean;
  seed?: number;
  /** Skip the neighbour pass: only the best fit to the gradient, for quickly scoring gradients. */
  quick?: boolean;
  /** Extra cost by album id, such as for records hung recently. */
  extraCost?: Readonly<Record<string, number>>;
}): {
  albums: Album[];
  artistConflicts: number;
  unmeasured: number;
  match: "close" | "fair" | "loose";
  meanFit: number;
  /** For a one-color gradient, how many covers in the collection are that color; otherwise null. */
  coversOfColor: number | null;
} {
  const { albums, rows, columns, pinned, profiles, gradient, keepArtistsApart } = input;
  const positions = Math.min(rows * columns, albums.length);
  const stops = gradientStops(gradient.colors);
  if (positions === 0 || stops.length === 0) {
    return {
      albums,
      artistConflicts: 0,
      unmeasured: 0,
      match: "close",
      meanFit: 0,
      coversOfColor: null,
    };
  }

  const profileOf = (cover: number) => profiles[String(albums[cover]!.id)] ?? null;
  const usable = (cover: number) => profileOf(cover) !== null;
  const measured = albums
    .map((_, cover) => profileOf(cover))
    .filter((profile): profile is CoverProfile => profile !== null);
  const samples = fitLightnessToCollection(
    tileSamples(stops, rows, columns, { kind: "linear", angle: gradient.angle }),
    measured
  );

  // Fit of every cover to every spot, worked out once: half how its regions line up with the
  // gradient across the spot, half how close its nearest main color is to the spot's color. The
  // regions alone blur a cover like a pink background behind a dark portrait into mauve, while
  // people see it as pink.
  const spotColors = samples.map(averageColor);
  const regionTable = Array.from({ length: positions }, (_, position) =>
    albums.map((_, cover) => {
      const profile = profileOf(cover);
      return profile ? regionFit(profile.regions, samples[position]!, profile.color) : null;
    })
  );
  const extra = (cover: number) => input.extraCost?.[String(albums[cover]!.id)] ?? 0;
  const fitTable = regionTable.map((row, position) =>
    row.map((regions, cover) =>
      regions === null
        ? UNMEASURED_COST
        : (regions + mainColorFit(profileOf(cover)!, spotColors[position]!)) / 2 + extra(cover)
    )
  );
  const fit = (position: number, cover: number) => fitTable[position]![cover]!;

  const edgeMemo = new Map<number, number>();
  const edge = (first: number, second: number, direction: "horizontal" | "vertical") => {
    const key = (first * albums.length + second) * 2 + (direction === "horizontal" ? 0 : 1);
    const known = edgeMemo.get(key);
    if (known !== undefined) return known;
    const a = profileOf(first);
    const b = profileOf(second);
    const value = a && b ? edgeFit(a.regions, b.regions, direction, a.color, b.color) : 0;
    edgeMemo.set(key, value);
    return value;
  };

  const pinnedAt = Array.from({ length: positions }, (_, position) =>
    pinned.has(String(albums[position]!.id)) ? position : null
  );
  const assigned = assignByCost({
    positions,
    candidates: albums.length,
    usable,
    pinned: pinnedAt,
    cost: fit,
  });
  const onWall = new Set(assigned);
  const spare = albums.map((_, cover) => cover).filter((cover) => !onWall.has(cover));

  const arranged = input.quick
    ? { order: assigned, spare, artistConflicts: 0 }
    : arrangeGradientWall({
        order: assigned,
        spare,
        pinned: pinnedAt.map((at) => at !== null),
        columns,
        fit,
        edge,
        neighbourWeight: NEIGHBOUR_WEIGHT,
        artists: albums.map((album) => album.artist ?? ""),
        keepArtistsApart,
        seed: input.seed ?? 1,
      });

  const wall = arranged.order.map((cover) => albums[cover]!);
  const wallIds = new Set(wall.map((album) => album.id));
  const pool = albums.filter((album) => !wallIds.has(album.id));
  const measuredFits = arranged.order
    .map((cover, position) => regionTable[position]![cover] ?? null)
    .filter((value): value is number => value !== null);
  const meanFit = measuredFits.length
    ? measuredFits.reduce((sum, value) => sum + value, 0) / measuredFits.length
    : Infinity;

  return {
    albums: [...wall, ...pool],
    artistConflicts: arranged.artistConflicts,
    unmeasured: albums.filter((_, cover) => !usable(cover)).length,
    match: meanFit < CLOSE_FIT ? "close" : meanFit < FAIR_FIT ? "fair" : "loose",
    meanFit,
    coversOfColor: coversOfOneColor(stops, measured),
  };
}
