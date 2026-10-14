/**
 * Functions for analyzing the "color flow" across an album wall.
 *
 * The wall is represented as a flat array of {@link CoverColor | CoverColor} or `null` where a cover has no readable color.
 * The helper functions below compute seams (adjacent positions), a flow score and
 * the worst‑seam subset for a wall.
 */

import type { CoverColor } from "./colorBasics";
import { colorDistance, wallSeamIndexes } from "./colorBasics";

/**
 * A seam is a pair of adjacent positions on the wall.
 *
 * - `a` and `b` are the positions of the two adjacent cells, where `a < b`.
 * - `distance` is the {@link colorDistance} between the two colors.
 */
export interface Seam {
  a: number;
  b: number;
  distance: number;
}

/**
 * For a wall of {@link CoverColor | CoverColor} positions, compute the seams
 * (adjacent cells) and their color distances.
 *
 * It ignores any pair where either position is `null`. The order of the returned
 * seams is the same as the order supplied by {@link wallSeamIndexes}.
 *
 * @param colors Array of colors, or `null` where a cover has no readable color.
 * @param columns Number of positions per row of the wall.
 * @returns Array of {@link Seam} objects.
 */
export function wallSeams(colors: (CoverColor | null)[], columns: number): Seam[] {
  const seams: Seam[] = [];
  for (const [a, b] of wallSeamIndexes(colors.length, columns)) {
    const ca = colors[a];
    const cb = colors[b];
    if (ca != null && cb != null) {
      seams.push({ a, b, distance: colorDistance(ca, cb) });
    }
  }
  return seams;
}

/**
 * The mean color distance of all seams.
 *
 * The flow score is lower when the wall is smoother.  If there are no seams,
 * `null` is returned.
 *
 * @param seams Array of {@link Seam} objects.
 * @returns Mean distance or `null`.
 */
export function flowScore(seams: Seam[]): number | null {
  if (seams.length === 0) return null;
  const total = seams.reduce((sum, s) => sum + s.distance, 0);
  return total / seams.length;
}

/**
 * Return a new array containing the `count` seams with the largest distance.
 *
 * The resulting array is sorted in descending order of distance.  When two
 * seams have the same distance they are ordered by smaller `a`, then smaller
 * `b`.  The input list is not modified.
 *
 * @param seams Array of seams to evaluate.
 * @param count How many of the worst seams to return.
 * @returns New array of the worst seams.
 */
export function worstSeams(seams: Seam[], count: number): Seam[] {
  if (count <= 0) return [];
  // Make a shallow copy to avoid mutating the input.
  const copy = seams.slice();
  copy.sort((s1, s2) => {
    if (s1.distance !== s2.distance) return s2.distance - s1.distance;
    if (s1.a !== s2.a) return s1.a - s2.a;
    return s1.b - s2.b;
  });
  return copy.slice(0, count);
}
