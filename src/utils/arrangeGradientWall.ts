/**
 * Optimise an album wall by arranging covers (gradient fit + neighbour seam quality
 * and optional artist separation) via seeded simulated annealing plus a greedy polish.
 *
 * Returns the best `order`, the corresponding `spare` pool, and the number of
 * artist conflicts remaining in that arrangement.
 */
export function arrangeGradientWall(input: {
  order: number[];
  spare: number[];
  pinned: boolean[];
  columns: number;
  fit: (position: number, cover: number) => number;
  edge: (first: number, second: number, direction: "horizontal" | "vertical") => number;
  neighbourWeight: number;
  artists: string[];
  keepArtistsApart: boolean;
  seed: number;
}): { order: number[]; spare: number[]; artistConflicts: number } {
  const columns = input.columns;
  const numPos = input.order.length;
  const unpinnedIndices: number[] = [];
  for (let i = 0; i < numPos; i++) if (!input.pinned[i]) unpinnedIndices.push(i);
  const unpinnedCount = unpinnedIndices.length;

  function mulberry32(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function countConflicts(arr: number[]): number {
    if (!input.keepArtistsApart) return 0;
    let c = 0;
    for (let p = 0; p < numPos; p++) {
      const a = arr[p]!;
      if (p % columns < columns - 1 && p + 1 < numPos) {
        const b = arr[p + 1]!;
        const sa = input.artists[a]!.trim().toLowerCase();
        const sb = input.artists[b]!.trim().toLowerCase();
        if (sa !== "" && sa === sb) c++;
      }
      if (p + columns < numPos) {
        const b = arr[p + columns]!;
        const sa = input.artists[a]!.trim().toLowerCase();
        const sb = input.artists[b]!.trim().toLowerCase();
        if (sa !== "" && sa === sb) c++;
      }
    }
    return c;
  }

  function computeCost(arr: number[]): number {
    let cost = 0;
    for (let p = 0; p < numPos; p++) cost += input.fit(p, arr[p]!);
    for (let p = 0; p < numPos; p++) {
      if (p % columns < columns - 1 && p + 1 < numPos) {
        cost += input.neighbourWeight * input.edge(arr[p]!, arr[p + 1]!, "horizontal");
      }
      if (p + columns < numPos) {
        cost += input.neighbourWeight * input.edge(arr[p]!, arr[p + columns]!, "vertical");
      }
    }
    return cost;
  }

  // --- simulated annealing ---
  const gen = mulberry32(input.seed);
  const totalIter = 2000 * unpinnedCount;

  let bestOrder = [...input.order];
  let bestSpare = [...input.spare];
  let bestConflicts = countConflicts(bestOrder);
  let bestCost = computeCost(bestOrder);

  if (unpinnedCount === 0) {
    return { order: bestOrder, spare: bestSpare, artistConflicts: bestConflicts };
  }

  const tStart = bestCost / numPos > 0 ? bestCost / numPos : 1;
  const tEnd = tStart / 1000;

  const curOrder = [...input.order];
  const curSpare = [...input.spare];
  let curConflicts = bestConflicts;
  let curCost = bestCost;

  for (let iter = 0; iter < totalIter; iter++) {
    const frac = iter / (totalIter - 1 || 1);
    const temp = tStart * Math.pow(tEnd / tStart, frac);

    const hasSpare = curSpare.length > 0;
    const doSpareSwap = hasSpare && gen() < 0.5;

    const trialOrder = [...curOrder];
    const trialSpare = [...curSpare];

    if (unpinnedCount === 1) {
      if (!hasSpare) continue;
      const wp = unpinnedIndices[0]!;
      const sp = Math.floor(gen() * trialSpare.length);
      const wallCover = trialOrder[wp]!;
      const spareCover = trialSpare[sp]!;
      trialOrder[wp] = spareCover;
      trialSpare[sp] = wallCover;
    } else if (doSpareSwap) {
      const wi = Math.floor(gen() * unpinnedIndices.length);
      const sp = Math.floor(gen() * trialSpare.length);
      const wp = unpinnedIndices[wi]!;
      const wallCover = trialOrder[wp]!;
      const spareCover = trialSpare[sp]!;
      trialOrder[wp] = spareCover;
      trialSpare[sp] = wallCover;
    } else {
      const i1 = Math.floor(gen() * unpinnedIndices.length);
      let i2 = Math.floor(gen() * unpinnedIndices.length);
      while (i2 === i1 && unpinnedIndices.length > 1)
        i2 = Math.floor(gen() * unpinnedIndices.length);
      const wA = unpinnedIndices[i1]!;
      const wB = unpinnedIndices[i2]!;
      const cA = trialOrder[wA]!;
      const cB = trialOrder[wB]!;
      trialOrder[wA] = cB;
      trialOrder[wB] = cA;
    }

    const trialConflicts = countConflicts(trialOrder);
    const trialCost = computeCost(trialOrder);

    // Fewer artist conflicts always wins; at equal conflicts a costlier arrangement is sometimes
    // accepted so the search can leave a local minimum, but only a better one becomes the best.
    const accept =
      trialConflicts < curConflicts ||
      (trialConflicts === curConflicts &&
        (trialCost <= curCost || gen() < Math.exp(-(trialCost - curCost) / (temp || 1e-12))));
    if (accept) {
      curOrder.splice(0, curOrder.length, ...trialOrder);
      curSpare.splice(0, curSpare.length, ...trialSpare);
      curConflicts = trialConflicts;
      curCost = trialCost;
      if (curConflicts < bestConflicts || (curConflicts === bestConflicts && curCost < bestCost)) {
        bestOrder = trialOrder;
        bestSpare = trialSpare;
        bestConflicts = curConflicts;
        bestCost = curCost;
      }
    }
  }

  // --- greedy polish ---
  const greedyOrder: number[] = [...bestOrder];
  const greedySpare: number[] = [...bestSpare];
  const greedyUnpinned = unpinnedIndices.slice();

  for (let pass = 0; pass < 10; pass++) {
    let changed = false;

    // Try every position swap
    for (let i = 0; i < greedyUnpinned.length; i++) {
      for (let j = i + 1; j < greedyUnpinned.length; j++) {
        const a = greedyUnpinned[i]!;
        const b = greedyUnpinned[j]!;
        const cA = greedyOrder[a]!;
        const cB = greedyOrder[b]!;
        greedyOrder[a] = cB;
        greedyOrder[b] = cA;
        const pc = countConflicts(greedyOrder);
        const ps = computeCost(greedyOrder);
        const betterFlag = pc < bestConflicts || (pc === bestConflicts && ps < bestCost);
        if (betterFlag) {
          bestOrder = [...greedyOrder];
          bestSpare = [...greedySpare];
          bestConflicts = pc;
          bestCost = ps;
          changed = true;
        } else {
          greedyOrder[a] = cA;
          greedyOrder[b] = cB;
        }
      }
    }

    // Try every position-spare swap
    for (let idx = 0; idx < greedyUnpinned.length; idx++) {
      const wp = greedyUnpinned[idx]!;
      for (let si = 0; si < greedySpare.length; si++) {
        const wallCover = greedyOrder[wp]!;
        const spareCover = greedySpare[si]!;
        greedyOrder[wp] = spareCover;
        greedySpare[si] = wallCover;
        const pc = countConflicts(greedyOrder);
        const ps = computeCost(greedyOrder);
        const betterFlag = pc < bestConflicts || (pc === bestConflicts && ps < bestCost);
        if (betterFlag) {
          bestOrder = [...greedyOrder];
          bestSpare = [...greedySpare];
          bestConflicts = pc;
          bestCost = ps;
          changed = true;
        } else {
          greedyOrder[wp] = wallCover;
          greedySpare[si] = spareCover;
        }
      }
    }

    if (!changed) break;
  }

  return { order: bestOrder, spare: bestSpare, artistConflicts: bestConflicts };
}
