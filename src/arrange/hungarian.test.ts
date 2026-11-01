import { describe, expect, it } from "vitest";
import { solveAssignment } from "./hungarian";

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

function bruteForce(cost: number[][]) {
  let best = Infinity;
  const used = new Set<number>();
  const walk = (row: number, total: number) => {
    if (row === cost.length) {
      best = Math.min(best, total);
      return;
    }
    cost[row]!.forEach((value, column) => {
      if (used.has(column)) return;
      used.add(column);
      walk(row + 1, total + value);
      used.delete(column);
    });
  };
  walk(0, 0);
  return best;
}

describe("solveAssignment", () => {
  it("finds the cheapest assignment on small random tables, square or wide", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const next = random(seed);
      const rows = 1 + Math.floor(next() * 6);
      const columns = rows + Math.floor(next() * 3);
      const cost = Array.from({ length: rows }, () =>
        Array.from({ length: columns }, () => next())
      );
      const result = solveAssignment(cost);
      expect(new Set(result).size).toBe(rows);
      const total = result.reduce((sum, column, row) => sum + cost[row]![column]!, 0);
      expect(total).toBeCloseTo(bruteForce(cost), 9);
    }
  });

  it("solves a known table", () => {
    expect(
      solveAssignment([
        [4, 1, 3],
        [2, 0, 5],
        [3, 2, 2],
      ])
    ).toEqual([1, 0, 2]);
  });

  it("handles no rows, and refuses more rows than columns", () => {
    expect(solveAssignment([])).toEqual([]);
    expect(() => solveAssignment([[1], [2]])).toThrow();
  });

  it("is quick for 32 rows and 500 columns", () => {
    const next = random(3);
    const cost = Array.from({ length: 32 }, () => Array.from({ length: 500 }, () => next()));
    const started = performance.now();
    solveAssignment(cost);
    expect(performance.now() - started).toBeLessThan(500);
  });
});
