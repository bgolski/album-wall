/**
 * Separate same-artist album covers on a wall.
 *
 * This function takes a wall layout (`order`), a spare pool of covers, and a set of pinned positions. It repeatedly looks for adjacent (right or below) pairs of covers that belong to the same artist (ignoring case and surrounding whitespace, and treating empty artists as distinct). For each conflict it tries to resolve it by either swapping a wall cover with another non‑pinned cover or replacing a wall cover with a spare cover, provided that the change removes that conflict and does not create any new conflicts. The change with the smallest increase in total cost (sum of `cost(position, cover)` over all wall positions) is chosen, with a deterministic tie‑breaker.
 *
 * The algorithm performs up to 20 passes over the list of conflicts; it stops early if a pass makes no changes. The inputs are not mutated; new arrays are returned.
 */
import { wallSeamIndexes } from "./colorBasics";

export interface SeparateSameArtistInput {
  order: number[]; // wall order by position
  spare: number[]; // covers not on the wall
  artists: string[]; // artists by cover id
  pinned: boolean[]; // true for pinned wall positions
  columns: number; // wall columns
  cost: (position: number, cover: number) => number; // cost per position
}

export interface SeparateSameArtistResult {
  order: number[];
  spare: number[];
}

/**
 * Resolve same‑artist conflicts on a wall.
 * @param input The input data.
 * @returns A new object with updated order and spare arrays.
 */
export function separateSameArtist(input: SeparateSameArtistInput): SeparateSameArtistResult {
  // Copy inputs to avoid mutation
  const order = [...input.order];
  const spare = [...input.spare];
  const { artists, pinned, columns, cost } = input;

  const n = order.length;

  // Helper to compute artist key
  const artistKey = (cover: number): string => {
    const a = artists[cover] ?? "";
    const t = a.trim().toLowerCase();
    return t === "" ? "" : t;
  };

  // Check if two wall positions have same artist (non‑empty)
  const sameArtist = (p1: number, p2: number, ord: number[] = order): boolean => {
    const k1 = artistKey(ord[p1]!);
    return k1 !== "" && k1 === artistKey(ord[p2]!);
  };

  // Compute conflicts list
  const computeConflicts = (ord: number[]): [number, number][] => {
    return wallSeamIndexes(ord.length, columns).filter(([a, b]) => sameArtist(a, b, ord));
  };

  let oldConflicts = computeConflicts(order);
  let changed = true;
  const maxPasses = 20;
  for (let pass = 0; pass < maxPasses && changed; pass++) {
    changed = false;
    const seams = wallSeamIndexes(order.length, columns);
    for (const [a, b] of seams) {
      if (!sameArtist(a, b)) continue; // conflict resolved already

      // gather candidate changes
      const candidates: {
        type: "replace" | "swap";
        x: number;
        y?: number;
        spareIdx?: number;
        delta: number;
      }[] = [];

      const considerReplace = (x: number, spareIdx: number) => {
        const spareCover = spare[spareIdx]!;
        const origCover = order[x]!;
        // Build new order and spare
        const newOrder = order.slice();
        const newSpare = spare.slice();
        newOrder[x] = spareCover;
        newSpare.splice(spareIdx, 1);
        newSpare.push(origCover);

        // Check conflicts
        const newConflicts = computeConflicts(newOrder);
        // Build sets of keys
        const key = (a: number, b: number) => {
          const i = a < b ? a : b;
          const j = a < b ? b : a;
          return `${i}-${j}`;
        };
        const pairKey = key(a, b);
        const oldSet = new Set(oldConflicts.map(([x, y]) => key(x, y)));
        const newSet = new Set(newConflicts.map(([x, y]) => key(x, y)));
        // Must remove the conflict and not add any new ones
        // Must remove this conflict and add no new one (clearing others as well is fine)
        if (newSet.has(pairKey)) return;
        for (const k of newSet) if (!oldSet.has(k)) return;
        // cost delta
        const delta = cost(x, spareCover) - cost(x, origCover);
        candidates.push({ type: "replace", x, spareIdx, delta });
      };

      const considerSwap = (x: number, y: number) => {
        const origX = order[x]!;
        const origY = order[y]!;
        const newOrder = order.slice();
        newOrder[x] = origY;
        newOrder[y] = origX;
        const newConflicts = computeConflicts(newOrder);
        const key = (a: number, b: number) => {
          const i = a < b ? a : b;
          const j = a < b ? b : a;
          return `${i}-${j}`;
        };
        const pairKey = key(a, b);
        const oldSet = new Set(oldConflicts.map(([x, y]) => key(x, y)));
        const newSet = new Set(newConflicts.map(([x, y]) => key(x, y)));
        // Must remove this conflict and add no new one (clearing others as well is fine)
        if (newSet.has(pairKey)) return;
        for (const k of newSet) if (!oldSet.has(k)) return;
        const delta = cost(x, origY) + cost(y, origX) - (cost(x, origX) + cost(y, origY));
        candidates.push({ type: "swap", x, y, delta });
      };

      // For each non‑pinned position in the conflict
      if (!pinned[a]) {
        // replace with each spare
        for (let si = 0; si < spare.length; si++) {
          considerReplace(a, si);
        }
        // swap with any other non‑pinned
        for (let y = 0; y < n; y++) {
          if (y !== a && !pinned[y]) considerSwap(a, y);
        }
      }
      if (!pinned[b]) {
        for (let si = 0; si < spare.length; si++) {
          considerReplace(b, si);
        }
        for (let y = 0; y < n; y++) {
          if (y !== b && !pinned[y]) considerSwap(b, y);
        }
      }

      if (candidates.length === 0) continue;
      // choose best candidate
      candidates.sort((c1, c2) => {
        if (c1.delta !== c2.delta) return c1.delta - c2.delta;
        if (c1.x !== c2.x) return c1.x - c2.x;
        const typePriority = (t: string) => (t === "replace" ? 0 : 1);
        if (typePriority(c1.type) !== typePriority(c2.type))
          return typePriority(c1.type) - typePriority(c2.type);
        if (c1.type === "replace") {
          return c1.spareIdx! - c2.spareIdx!;
        }
        return c1.y! - c2.y!;
      });
      const best = candidates[0]!;

      // Apply best change
      if (best.type === "replace") {
        const spareIdx = best.spareIdx!;
        const spareCover = spare[spareIdx]!;
        const origCover = order[best.x]!;
        order[best.x] = spareCover;
        spare.splice(spareIdx, 1);
        spare.push(origCover);
      } else {
        const x = best.x;
        const y = best.y!;
        const tmp = order[x]!;
        order[x] = order[y]!;
        order[y] = tmp;
      }
      changed = true;
      oldConflicts = computeConflicts(order);
    }
  }

  return { order, spare };
}
