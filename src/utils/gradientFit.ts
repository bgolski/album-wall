import type { CoverColor } from "./colorBasics";
import { colorDistance } from "./colorBasics";
import { gradientTargets } from "./gradientTargets";
import type { GradientStop, GradientShape } from "./gradientTargets";

/**
 * Computes a grid of 3x3 samples for each tile in a wall layout.
 *
 * The wall is composed of `rows` rows and `columns` columns of tiles.
 * For a finer resolution, we first generate a gradient over a grid
 * that is three times larger in each dimension (`rows * 3` × `columns * 3`).
 * Each wall tile then contains the 9 colors from the corresponding
 * 3×3 block of the fine grid, laid out row‑major.
 *
 * If `gradientTargets` returns an empty array (e.g. when no stops
 * are supplied), this function also returns an empty array.
 *
 * @param stops  The gradient stops.
 * @param rows   Number of rows in the wall.
 * @param columns Number of columns in the wall.
 * @param shape   Gradient shape descriptor.
 * @returns A two‑dimensional array where each element is an array of nine
 *          `CoverColor` samples for a tile.
 */
export function tileSamples(
  stops: GradientStop[],
  rows: number,
  columns: number,
  shape: GradientShape
): CoverColor[][] {
  const fine = gradientTargets(stops, rows * 3, columns * 3, shape);
  if (fine.length === 0) return [];
  const tileCount = rows * columns;
  const tiles: CoverColor[][] = new Array(tileCount);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const tile: CoverColor[] = [];
      for (let fr = r * 3; fr < r * 3 + 3; fr++) {
        for (let fc = c * 3; fc < c * 3 + 3; fc++) {
          const idx = fr * (columns * 3) + fc;
          tile.push(fine[idx]!);
        }
      }
      tiles[r * columns + c] = tile;
    }
  }
  return tiles;
}

/**
 * Computes the mean color distance between two 3×3 regions.
 *
 * The `regions` array is expected to contain nine values, each of which is
 * either a `CoverColor` or `null`. If a value is `null`, the supplied
 * `fallback` color is used instead.
 * The `samples` array must also contain nine `CoverColor` values.
 *
 * The result is the arithmetic mean of the Euclidean distances in OKLab
 * space between each region element and the corresponding sample.
 *
 * @param regions  Array of actual or missing region colors.
 * @param samples  Array of expected sample colors.
 * @param fallback Color to use when a region entry is missing.
 * @returns The average color distance.
 */
export function regionFit(
  regions: (CoverColor | null)[],
  samples: CoverColor[],
  fallback: CoverColor
): number {
  const count = 9; // expected length
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const actual = regions[i] ?? fallback;
    sum += colorDistance(actual, samples[i]!);
  }
  return sum / count;
}
