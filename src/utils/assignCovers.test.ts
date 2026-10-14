import { describe, expect, it } from "vitest";
import { colorDistance, type CoverColor } from "./colorBasics";
import { assignCoversToTargets } from "./assignCovers";

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

const randomColor = (next: () => number): CoverColor => ({
  l: next(),
  a: (next() - 0.5) * 0.4,
  b: (next() - 0.5) * 0.4,
});

// The smallest total distance over every way of giving each free position its own usable cover.
function bruteForceMinimum(
  targets: CoverColor[],
  candidates: (CoverColor | null)[],
  pinned: (number | null)[]
) {
  const taken = new Set(pinned.filter((index): index is number => index !== null));
  const usable = candidates.map((_, index) => index).filter((i) => candidates[i] && !taken.has(i));
  const free = targets.map((_, p) => p).filter((p) => pinned[p] === null);
  let best = Infinity;
  const used = new Set<number>();
  const walk = (slot: number, total: number) => {
    if (total >= best) return;
    if (slot === free.length) {
      best = total;
      return;
    }
    for (const c of usable) {
      if (used.has(c)) continue;
      used.add(c);
      walk(slot + 1, total + colorDistance(targets[free[slot]!]!, candidates[c]!));
      used.delete(c);
    }
  };
  walk(0, 0);
  return best;
}

function totalDistance(
  targets: CoverColor[],
  candidates: (CoverColor | null)[],
  pinned: (number | null)[],
  result: number[]
) {
  let total = 0;
  result.forEach((c, p) => {
    if (pinned[p] === null) total += colorDistance(targets[p]!, candidates[c]!);
  });
  return total;
}

describe("assignCoversToTargets", () => {
  it("finds the smallest total distance on many small random cases", () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const next = random(seed);
      const positions = 2 + Math.floor(next() * 5);
      const covers = positions + Math.floor(next() * 4);
      const targets = Array.from({ length: positions }, () => randomColor(next));
      const candidates = Array.from({ length: covers }, () => randomColor(next));
      const pinned: (number | null)[] = Array(positions).fill(null);
      const result = assignCoversToTargets({ targets, candidates, pinned });
      expect(result).toHaveLength(positions);
      expect(new Set(result).size).toBe(positions);
      expect(totalDistance(targets, candidates, pinned, result)).toBeCloseTo(
        bruteForceMinimum(targets, candidates, pinned),
        6
      );
    }
  });

  it("keeps pinned covers in place and does not use them anywhere else", () => {
    for (let seed = 100; seed < 115; seed += 1) {
      const next = random(seed);
      const targets = Array.from({ length: 6 }, () => randomColor(next));
      const candidates = Array.from({ length: 9 }, () => randomColor(next));
      const pinned: (number | null)[] = [null, 4, null, null, 7, null];
      const result = assignCoversToTargets({ targets, candidates, pinned });
      expect(result[1]).toBe(4);
      expect(result[4]).toBe(7);
      expect(result.filter((c) => c === 4 || c === 7)).toHaveLength(2);
      expect(new Set(result).size).toBe(6);
      expect(totalDistance(targets, candidates, pinned, result)).toBeCloseTo(
        bruteForceMinimum(targets, candidates, pinned),
        6
      );
    }
  });

  it("prefers the cover with the lower index when two are equally good", () => {
    const color: CoverColor = { l: 0.5, a: 0.1, b: 0.1 };
    const result = assignCoversToTargets({
      targets: [color],
      candidates: [{ l: 0.9, a: 0, b: 0 }, color, color],
      pinned: [null],
    });
    expect(result).toEqual([1]);
  });

  it("uses covers with no color only when there are not enough with one", () => {
    const targets: CoverColor[] = [
      { l: 0, a: 0, b: 0 },
      { l: 0.5, a: 0, b: 0 },
      { l: 1, a: 0, b: 0 },
    ];
    const enough = assignCoversToTargets({
      targets,
      candidates: [
        null,
        { l: 0.1, a: 0, b: 0 },
        { l: 0.5, a: 0, b: 0 },
        null,
        { l: 0.9, a: 0, b: 0 },
      ],
      pinned: [null, null, null],
    });
    expect(enough).toEqual([1, 2, 4]);

    const scarce = assignCoversToTargets({
      targets,
      candidates: [null, { l: 0.5, a: 0, b: 0 }, null],
      pinned: [null, null, null],
    });
    expect(scarce).toEqual([0, 1, 2]);
  });

  it("uses -1 for a position when there is nothing left to put there", () => {
    const targets: CoverColor[] = [
      { l: 0, a: 0, b: 0 },
      { l: 1, a: 0, b: 0 },
      { l: 0.5, a: 0, b: 0 },
    ];
    const result = assignCoversToTargets({
      targets,
      candidates: [
        { l: 0.05, a: 0, b: 0 },
        { l: 0.95, a: 0, b: 0 },
      ],
      pinned: [null, null, null],
    });
    expect(result.slice(0, 2)).toEqual([0, 1]);
    expect(result[2]).toBe(-1);
  });

  it("handles an empty wall and a wall that is entirely pinned", () => {
    expect(assignCoversToTargets({ targets: [], candidates: [], pinned: [] })).toEqual([]);
    expect(
      assignCoversToTargets({
        targets: [
          { l: 0.1, a: 0, b: 0 },
          { l: 0.9, a: 0, b: 0 },
        ],
        candidates: [
          { l: 0.5, a: 0, b: 0 },
          { l: 0.2, a: 0, b: 0 },
          { l: 0.8, a: 0, b: 0 },
        ],
        pinned: [2, 0],
      })
    ).toEqual([2, 0]);
  });

  it("gives the same answer for the same input", () => {
    const next = random(77);
    const input = {
      targets: Array.from({ length: 12 }, () => randomColor(next)),
      candidates: Array.from({ length: 40 }, () => randomColor(next)),
      pinned: Array<number | null>(12).fill(null),
    };
    expect(assignCoversToTargets(input)).toEqual(assignCoversToTargets(input));
  });

  it("matches 32 positions against 500 covers quickly", () => {
    const next = random(5);
    const input = {
      targets: Array.from({ length: 32 }, () => randomColor(next)),
      candidates: Array.from({ length: 500 }, () => randomColor(next)),
      pinned: Array<number | null>(32).fill(null),
    };
    const started = performance.now();
    const result = assignCoversToTargets(input);
    expect(performance.now() - started).toBeLessThan(1000);
    expect(new Set(result).size).toBe(32);
  });
});
