import { colorDistance, type CoverColor } from "./colorBasics";
import { solveAssignment } from "./hungarian";

/**
 * Picks the cover for each wall position so the covers' colors are as close as possible to the
 * colors wanted, using each cover at most once.
 *
 * Pinned positions keep their cover, which is not used anywhere else. Free positions get the
 * covers with a color that give the smallest total distance (equal choices go to the lower cover
 * index). When there are too few covers with a color, the rest of the free positions get the unused
 * covers without one, in index order, and then `-1`.
 *
 * @param input.targets Color wanted at each position.
 * @param input.candidates Each cover's color, or `null` when it has none.
 * @param input.pinned For each position, the cover that must stay there, or `null`.
 * @returns For each position, the index of its cover, or `-1` when there is none to put there.
 */
export function assignCoversToTargets(input: {
  targets: CoverColor[];
  candidates: (CoverColor | null)[];
  pinned: (number | null)[];
}): number[] {
  const { targets, candidates, pinned } = input;
  const result = targets.map((_, position) => pinned[position] ?? -1);
  const taken = new Set(pinned.filter((cover): cover is number => cover !== null));
  const free = targets
    .map((_, position) => position)
    .filter((position) => pinned[position] === null);
  const usable = candidates
    .map((_, cover) => cover)
    .filter((cover) => candidates[cover] !== null && !taken.has(cover));
  const cost = (position: number, cover: number) =>
    colorDistance(targets[position]!, candidates[cover]!) + cover * 1e-9;

  if (free.length > 0 && usable.length > 0) {
    if (usable.length >= free.length) {
      const columns = solveAssignment(
        free.map((position) => usable.map((cover) => cost(position, cover)))
      );
      free.forEach((position, row) => (result[position] = usable[columns[row]!]!));
    } else {
      const columns = solveAssignment(
        usable.map((cover) => free.map((position) => cost(position, cover)))
      );
      usable.forEach((cover, row) => (result[free[columns[row]!]!] = cover));
    }
  }

  const placed = new Set(result);
  const fillers = candidates
    .map((_, cover) => cover)
    .filter((cover) => candidates[cover] === null && !taken.has(cover) && !placed.has(cover));
  for (const position of free)
    if (result[position] === -1) result[position] = fillers.shift() ?? -1;
  return result;
}
