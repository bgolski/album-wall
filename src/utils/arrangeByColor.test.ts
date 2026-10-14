import { describe, expect, it } from "vitest";
import { colorDistance, wallSeamIndexes, type CoverColor } from "./colorBasics";
import { arrangeByColorFlow } from "./arrangeByColor";

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

function randomColors(count: number, seed: number, missing = 0): (CoverColor | null)[] {
  const next = random(seed);
  const colors: (CoverColor | null)[] = Array.from({ length: count }, () => ({
    l: next(),
    a: (next() - 0.5) * 0.4,
    b: (next() - 0.5) * 0.4,
  }));
  for (let i = 0; i < missing; i += 1) colors[Math.floor(next() * count)] = null;
  return colors;
}

// Sum of seam distances for the wall after applying `order` (order[p] = cover now at position p).
function objective(colors: (CoverColor | null)[], order: number[], columns: number) {
  let total = 0;
  for (const [a, b] of wallSeamIndexes(order.length, columns)) {
    const x = colors[order[a]!];
    const y = colors[order[b]!];
    if (x && y) total += colorDistance(x, y);
  }
  return total;
}

const identity = (count: number) => Array.from({ length: count }, (_, i) => i);
const isPermutation = (order: number[], count: number) =>
  order.length === count && [...order].sort((x, y) => x - y).every((value, i) => value === i);

function permutations(items: number[]): number[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest])
  );
}

describe("arrangeByColorFlow", () => {
  it("returns a permutation of the positions", () => {
    for (const [count, columns, seed] of [
      [32, 8, 1],
      [12, 4, 2],
      [7, 3, 3],
    ] as const) {
      const colors = randomColors(count, seed);
      const order = arrangeByColorFlow({
        colors,
        pinned: Array(count).fill(false),
        columns,
        mode: "flow",
        seed: 5,
      });
      expect(isPermutation(order, count)).toBe(true);
    }
  });

  it("keeps pinned covers where they are", () => {
    const colors = randomColors(32, 11);
    const pinned = colors.map((_, i) => i % 5 === 0);
    const order = arrangeByColorFlow({ colors, pinned, columns: 8, mode: "flow", seed: 3 });
    expect(isPermutation(order, 32)).toBe(true);
    pinned.forEach((isPinned, i) => {
      if (isPinned) expect(order[i]).toBe(i);
    });
  });

  it("never makes the flow worse and never makes the contrast worse", () => {
    for (let seed = 1; seed <= 6; seed += 1) {
      const colors = randomColors(32, seed * 7, 2);
      const pinned = colors.map((_, i) => i === 3 || i === 20);
      const before = objective(colors, identity(32), 8);
      const flow = arrangeByColorFlow({ colors, pinned, columns: 8, mode: "flow", seed });
      const contrast = arrangeByColorFlow({ colors, pinned, columns: 8, mode: "contrast", seed });
      expect(objective(colors, flow, 8)).toBeLessThanOrEqual(before + 1e-9);
      expect(objective(colors, contrast, 8)).toBeGreaterThanOrEqual(before - 1e-9);
    }
  });

  it("clearly improves a wall where every neighbor is opposite", () => {
    const colors: CoverColor[] = Array.from({ length: 32 }, (_, i) => ({
      l: (Math.floor(i / 8) + (i % 8)) % 2,
      a: 0,
      b: 0,
    }));
    const before = objective(colors, identity(32), 8);
    const order = arrangeByColorFlow({
      colors,
      pinned: Array(32).fill(false),
      columns: 8,
      mode: "flow",
      seed: 9,
    });
    expect(objective(colors, order, 8)).toBeLessThan(before * 0.6);
  });

  it("finds the best and the worst arrangement of a 2 by 2 wall", () => {
    const colors: CoverColor[] = [0, 0.9, 0.1, 1].map((l) => ({ l, a: 0, b: 0 }));
    const scores = permutations(identity(4)).map((order) => objective(colors, order, 2));
    const run = (mode: "flow" | "contrast") =>
      arrangeByColorFlow({ colors, pinned: Array(4).fill(false), columns: 2, mode, seed: 1 });
    expect(objective(colors, run("flow"), 2)).toBeCloseTo(Math.min(...scores), 9);
    expect(objective(colors, run("contrast"), 2)).toBeCloseTo(Math.max(...scores), 9);
  });

  it("gives the same answer for the same input and seed", () => {
    const colors = randomColors(32, 4);
    const input = {
      colors,
      pinned: Array(32).fill(false),
      columns: 8,
      mode: "flow" as const,
      seed: 21,
    };
    expect(arrangeByColorFlow(input)).toEqual(arrangeByColorFlow(input));
  });

  it("stays valid, pinned and no worse for other seeds", () => {
    const colors = randomColors(24, 8);
    const pinned = colors.map((_, i) => i === 0);
    const before = objective(colors, identity(24), 6);
    for (const seed of [0, 1, 99, 123456]) {
      const order = arrangeByColorFlow({ colors, pinned, columns: 6, mode: "flow", seed });
      expect(isPermutation(order, 24)).toBe(true);
      expect(order[0]).toBe(0);
      expect(objective(colors, order, 6)).toBeLessThanOrEqual(before + 1e-9);
    }
  });

  it("lets covers with no color move and ignores them when scoring", () => {
    const colors = randomColors(16, 14, 4);
    const before = objective(colors, identity(16), 4);
    const order = arrangeByColorFlow({
      colors,
      pinned: Array(16).fill(false),
      columns: 4,
      mode: "flow",
      seed: 2,
    });
    expect(isPermutation(order, 16)).toBe(true);
    expect(objective(colors, order, 4)).toBeLessThanOrEqual(before + 1e-9);
  });

  it("returns the identity when fewer than two covers can move", () => {
    const colors = randomColors(8, 5);
    expect(
      arrangeByColorFlow({ colors, pinned: Array(8).fill(true), columns: 4, mode: "flow", seed: 1 })
    ).toEqual(identity(8));
    const onlyOne = colors.map((_, i) => i !== 2);
    expect(
      arrangeByColorFlow({ colors, pinned: onlyOne, columns: 4, mode: "flow", seed: 1 })
    ).toEqual(identity(8));
  });

  it("is quick enough to run when a button is pressed", () => {
    const colors = randomColors(32, 17);
    const started = performance.now();
    arrangeByColorFlow({
      colors,
      pinned: Array(32).fill(false),
      columns: 8,
      mode: "flow",
      seed: 1,
    });
    expect(performance.now() - started).toBeLessThan(500);
  });
});
