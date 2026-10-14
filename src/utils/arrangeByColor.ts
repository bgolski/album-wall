/**
 * Arrange album covers on a wall to optimize color flow or contrast.
 *
 * The wall is a 2-D grid with a given number of columns. The algorithm
 * starts from the identity placement, keeps pinned covers in place, and
 * rearranges the remaining covers using simulated annealing followed by a
 * greedy improvement pass.
 *
 * The resulting permutation is an array where `result[p]` is the original
 * index of the cover that should occupy the p-th position on the wall.
 */

import { type CoverColor, colorDistance, wallSeamIndexes } from "./colorBasics";

/**
 * Deterministic PRNG using the mulberry32 algorithm.
 */
function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Permutes the indices of a wall of covers to either minimize or maximize
 * the sum of color distances along touching edges.
 *
 * @param input.colors  Array of cover colors or null for covers without
 *                      color information.
 * @param input.pinned  Boolean array indicating which positions are fixed.
 * @param input.columns Number of columns per row in the wall.
 * @param input.mode    "flow" to minimize color differences, "contrast" to
 *                      maximize them.
 * @param input.seed    Seed for the deterministic random number generator.
 * @returns A permutation array; result[p] is the original index of the
 *          cover that should be placed at position p.
 */
export function arrangeByColorFlow(input: {
  colors: (CoverColor | null)[];
  pinned: boolean[];
  columns: number;
  mode: "flow" | "contrast";
  seed: number;
}): number[] {
  const { colors, pinned, columns, mode, seed } = input;
  const count = colors.length;
  const unpinnedIdx: number[] = [];
  for (let i = 0; i < count; i += 1) {
    if (!pinned[i]) unpinnedIdx.push(i);
  }
  if (unpinnedIdx.length < 2) return Array.from({ length: count }, (_, i) => i);

  const rng = mulberry32(seed);
  const seams = wallSeamIndexes(count, columns);

  const swap = (arr: number[], i: number, j: number): void => {
    const tmp = arr[i]!;
    arr[i]! = arr[j]!;
    arr[j]! = tmp;
  };

  // cost of a given order
  const cost = (order: number[]): number => {
    let sum = 0;
    for (let si = 0; si < seams.length; si += 1) {
      const pair = seams[si]!;
      const a = pair[0];
      const b = pair[1];
      const ca = colors[order[a]!];
      const cb = colors[order[b]!];
      if (ca != null && cb != null) sum += colorDistance(ca, cb);
    }
    return mode === "contrast" ? -sum : sum;
  };

  // initial order and cost
  const order: number[] = Array.from({ length: count }, (_, i) => i);
  const identityCost = cost(order);
  let currentCost = identityCost;
  let bestOrder = order.slice();
  let bestCost = currentCost;

  // mean of seam distances for identity (used for temperature)
  let sumDist = 0;
  let seamCount = 0;
  for (let si = 0; si < seams.length; si += 1) {
    const pair = seams[si]!;
    const ca = colors[pair[0]];
    const cb = colors[pair[1]];
    if (ca != null && cb != null) {
      sumDist += colorDistance(ca, cb);
      seamCount += 1;
    }
  }
  const t0 = seamCount === 0 || sumDist === 0 ? 1 : sumDist / seamCount;
  const tFinal = t0 / 1000;
  const iterations = 400 * unpinnedIdx.length;
  for (let iter = 0; iter < iterations; iter += 1) {
    // pick two distinct unpinned indices
    const iIdx = Math.floor(rng() * unpinnedIdx.length);
    let jIdx = Math.floor(rng() * unpinnedIdx.length);
    while (jIdx === iIdx) jIdx = Math.floor(rng() * unpinnedIdx.length);
    const iPos = unpinnedIdx[iIdx]!;
    const jPos = unpinnedIdx[jIdx]!;
    // swap
    swap(order, iPos, jPos);
    const newCost = cost(order);
    const rise = newCost - currentCost;
    if (rise <= 0 || rng() < Math.exp(-rise / (t0 * Math.pow(tFinal / t0, iter / iterations)))) {
      currentCost = newCost;
      if (newCost < bestCost) {
        bestCost = newCost;
        bestOrder = order.slice();
      }
    } else {
      // revert swap
      swap(order, iPos, jPos);
    }
  }

  // take best arrangement from SA
  const finalOrder = bestOrder;
  let finalCost = bestCost;

  // Greedy improvement pass
  const maxPasses = 20;
  for (let pass = 0; pass < maxPasses; pass += 1) {
    let changed = false;
    for (let ii = 0; ii < unpinnedIdx.length; ii += 1) {
      for (let jj = ii + 1; jj < unpinnedIdx.length; jj += 1) {
        const iPos = unpinnedIdx[ii]!;
        const jPos = unpinnedIdx[jj]!;
        swap(finalOrder, iPos, jPos);
        const newC = cost(finalOrder);
        if (newC < finalCost) {
          finalCost = newC;
          changed = true;
        } else {
          swap(finalOrder, iPos, jPos);
        }
      }
    }
    if (!changed) break;
  }
  return finalOrder;
}
