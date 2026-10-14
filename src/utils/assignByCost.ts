import { solveAssignment } from "./hungarian";

/**
 * Assigns covers to wall positions while minimizing total cost, respecting pins and usability.
 *
 * The algorithm proceeds in three phases:
 * 1. Place pinned positions and record which covers are already taken.
 * 2. For free positions and usable covers, build a cost matrix and solve the assignment
 *    problem.  If there are fewer usable covers than free positions, we solve the
 *    assignment in the reversed orientation (one row per usable cover) so every usable
 *    cover is assigned to the best free position.  Free positions that remain unassigned
 *    are later filled with unusable covers.
 * 3. Remaining free positions are filled with the unused, unusable covers in increasing
 *    index order, and if none are left the position receives `-1`.
 *
 * @param input
 *  - `positions`: number of wall positions (0 .. positions-1).
 *  - `candidates`: number of cover candidates (0 .. candidates-1).
 *  - `usable`: predicate to decide if a cover is eligible for the assignment.
 *  - `pinned`: array indexed by position; the cover that must stay at that position
 *    (or `null` if none).  A pinned cover is never used elsewhere.
 *  - `cost`: function `cost(position, cover)` returning a numeric cost.
 *
 * @returns An array of length `positions`; each entry is the cover index that should
 *          occupy the corresponding position, or `-1` if the position remains empty.
 */
export function assignByCost(input: {
  positions: number;
  candidates: number;
  usable: (cover: number) => boolean;
  pinned: (number | null)[];
  cost: (position: number, cover: number) => number;
}): number[] {
  const { positions, candidates, usable, pinned, cost } = input;
  const result = Array.from({ length: positions }, (_, p) => pinned[p] ?? -1);
  const taken = new Set(pinned.filter((c): c is number => c !== null));

  const freePositions: number[] = [];
  for (let p = 0; p < positions; p++) if (pinned[p] === null) freePositions.push(p);

  const usableCovers: number[] = [];
  for (let c = 0; c < candidates; c++) if (usable(c) && !taken.has(c)) usableCovers.push(c);

  if (freePositions.length > 0 && usableCovers.length > 0) {
    if (usableCovers.length >= freePositions.length) {
      const matrix = freePositions.map((p) => usableCovers.map((c) => cost(p, c) + c * 1e-9));
      const columns = solveAssignment(matrix);
      for (let i = 0; i < freePositions.length; i++) {
        const p = freePositions[i]!;
        const col = columns[i]!;
        if (col !== undefined) {
          result[p] = usableCovers[col]!;
        }
      }
    } else {
      const matrix = usableCovers.map((c) => freePositions.map((p) => cost(p, c) + p * 1e-9));
      const columns = solveAssignment(matrix);
      for (let i = 0; i < usableCovers.length; i++) {
        const c = usableCovers[i]!;
        const col = columns[i]!;
        if (col !== undefined) {
          result[freePositions[col]!] = c;
        }
      }
    }
  }

  const usedCovers = new Set(result.filter((c): c is number => c !== -1));
  const fillers: number[] = [];
  for (let c = 0; c < candidates; c++) {
    if (!usable(c) && !taken.has(c) && !usedCovers.has(c)) fillers.push(c);
  }
  for (const p of freePositions) {
    if (result[p] === -1) result[p] = fillers.shift() ?? -1;
  }

  return result;
}
