import { describe, expect, it } from "vitest";
import { assignByCost } from "./assignByCost";

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function table(positions: number, candidates: number, seed: number) {
  const next = random(seed);
  return Array.from({ length: positions }, () => Array.from({ length: candidates }, () => next()));
}

function bruteForce(costs: number[][], usable: (c: number) => boolean, pinned: (number | null)[]) {
  const taken = new Set(pinned.filter((c): c is number => c !== null));
  const covers = costs[0]!.map((_, c) => c).filter((c) => usable(c) && !taken.has(c));
  const free = costs.map((_, p) => p).filter((p) => pinned[p] === null);
  let best = Infinity;
  const used = new Set<number>();
  const walk = (slot: number, total: number) => {
    if (total >= best) return;
    if (slot === free.length) {
      best = total;
      return;
    }
    for (const c of covers) {
      if (used.has(c)) continue;
      used.add(c);
      walk(slot + 1, total + costs[free[slot]!]![c]!);
      used.delete(c);
    }
  };
  walk(0, 0);
  return best;
}

const total = (costs: number[][], result: number[], pinned: (number | null)[]) =>
  result.reduce((sum, c, p) => (pinned[p] === null ? sum + costs[p]![c]! : sum), 0);

describe("assignByCost", () => {
  it("finds the smallest total cost on small random tables", () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const next = random(seed * 13);
      const positions = 2 + Math.floor(next() * 5);
      const candidates = positions + Math.floor(next() * 4);
      const costs = table(positions, candidates, seed);
      const pinned: (number | null)[] = Array(positions).fill(null);
      const result = assignByCost({
        positions,
        candidates,
        usable: () => true,
        pinned,
        cost: (p, c) => costs[p]![c]!,
      });
      expect(new Set(result).size).toBe(positions);
      expect(total(costs, result, pinned)).toBeCloseTo(
        bruteForce(costs, () => true, pinned),
        6
      );
    }
  });

  it("keeps pinned covers in place and never reuses them", () => {
    const costs = table(5, 8, 7);
    const pinned: (number | null)[] = [null, 6, null, 2, null];
    const result = assignByCost({
      positions: 5,
      candidates: 8,
      usable: () => true,
      pinned,
      cost: (p, c) => costs[p]![c]!,
    });
    expect(result[1]).toBe(6);
    expect(result[3]).toBe(2);
    expect(result.filter((c) => c === 6 || c === 2)).toHaveLength(2);
    expect(total(costs, result, pinned)).toBeCloseTo(
      bruteForce(costs, () => true, pinned),
      6
    );
  });

  it("uses unusable covers only to fill what is left, then -1", () => {
    const costs = [
      [0.5, 0.1, 0.9],
      [0.5, 0.9, 0.1],
      [0.5, 0.5, 0.5],
    ];
    const usable = (c: number) => c !== 0;
    expect(
      assignByCost({
        positions: 3,
        candidates: 3,
        usable,
        pinned: [null, null, null],
        cost: (p, c) => costs[p]![c]!,
      })
    ).toEqual([1, 2, 0]);
    // Two covers for three spots: each cover goes where it fits best, and the last spot is empty.
    const scarce = [
      [0.1, 0.9],
      [0.9, 0.1],
      [0.5, 0.6],
    ];
    expect(
      assignByCost({
        positions: 3,
        candidates: 2,
        usable: () => true,
        pinned: [null, null, null],
        cost: (p, c) => scarce[p]![c]!,
      })
    ).toEqual([0, 1, -1]);
  });

  it("prefers the lower cover index between equal costs", () => {
    expect(
      assignByCost({
        positions: 1,
        candidates: 3,
        usable: () => true,
        pinned: [null],
        cost: (_p, c) => (c === 0 ? 1 : 0),
      })
    ).toEqual([1]);
  });

  it("handles an empty wall and gives the same answer every time", () => {
    expect(
      assignByCost({ positions: 0, candidates: 3, usable: () => true, pinned: [], cost: () => 0 })
    ).toEqual([]);
    const costs = table(10, 30, 3);
    const input = {
      positions: 10,
      candidates: 30,
      usable: () => true,
      pinned: Array<number | null>(10).fill(null),
      cost: (p: number, c: number) => costs[p]![c]!,
    };
    expect(assignByCost(input)).toEqual(assignByCost(input));
  });

  it("matches 32 positions against 500 covers quickly", () => {
    const costs = table(32, 500, 9);
    const started = performance.now();
    const result = assignByCost({
      positions: 32,
      candidates: 500,
      usable: () => true,
      pinned: Array<number | null>(32).fill(null),
      cost: (p, c) => costs[p]![c]!,
    });
    expect(performance.now() - started).toBeLessThan(1000);
    expect(new Set(result).size).toBe(32);
  });
});
