import { describe, expect, it } from "vitest";
import { arrangeGradientWall } from "./arrangeGradientWall";

type Input = Parameters<typeof arrangeGradientWall>[0];

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

function seams(count: number, columns: number) {
  const pairs: [number, number, "horizontal" | "vertical"][] = [];
  for (let p = 0; p < count; p += 1) {
    if (p % columns < columns - 1 && p + 1 < count) pairs.push([p, p + 1, "horizontal"]);
    if (p + columns < count) pairs.push([p, p + columns, "vertical"]);
  }
  return pairs;
}

const sameArtist = (artists: string[], x: number, y: number) => {
  const a = artists[x]!.trim().toLowerCase();
  return a !== "" && a === artists[y]!.trim().toLowerCase();
};

function score(input: Input, order: number[]) {
  let cost = 0;
  let conflicts = 0;
  order.forEach((cover, p) => (cost += input.fit(p, cover)));
  for (const [a, b, direction] of seams(order.length, input.columns)) {
    cost += input.neighbourWeight * input.edge(order[a]!, order[b]!, direction);
    if (input.keepArtistsApart && sameArtist(input.artists, order[a]!, order[b]!)) conflicts += 1;
  }
  return { cost, conflicts };
}

function randomInput(
  seed: number,
  positions: number,
  columns: number,
  spare: number,
  overrides: Partial<Input> = {}
): Input {
  const next = random(seed);
  const covers = positions + spare;
  const fit = Array.from({ length: positions }, () => Array.from({ length: covers }, () => next()));
  const edges = Array.from({ length: covers }, () => Array.from({ length: covers }, () => next()));
  return {
    order: Array.from({ length: positions }, (_, i) => i),
    spare: Array.from({ length: spare }, (_, i) => positions + i),
    pinned: Array(positions).fill(false),
    columns,
    fit: (p, c) => fit[p]![c]!,
    edge: (a, b, direction) => edges[a]![b]! * (direction === "horizontal" ? 1 : 0.8),
    neighbourWeight: 0.5,
    artists: Array.from({ length: covers }, (_, c) => `artist ${c % 3}`),
    keepArtistsApart: false,
    seed: 1,
    ...overrides,
  };
}

const allCovers = (result: { order: number[]; spare: number[] }) =>
  [...result.order, ...result.spare].sort((x, y) => x - y);

describe("arrangeGradientWall", () => {
  it("never makes the wall worse and keeps every cover exactly once", () => {
    for (let seed = 1; seed <= 8; seed += 1) {
      const input = randomInput(seed, 12, 4, 10);
      const before = score(input, input.order);
      const result = arrangeGradientWall(input);
      expect(score(input, result.order).cost).toBeLessThanOrEqual(before.cost + 1e-9);
      expect(allCovers(result)).toEqual(Array.from({ length: 22 }, (_, i) => i));
      expect(result.artistConflicts).toBe(0);
    }
  });

  it("keeps pinned positions as they are", () => {
    const input = randomInput(3, 12, 4, 6, {
      pinned: Array.from({ length: 12 }, (_, p) => p % 4 === 1),
    });
    const result = arrangeGradientWall(input);
    input.pinned.forEach((isPinned, p) => {
      if (isPinned) expect(result.order[p]).toBe(p);
    });
  });

  it("gives the same answer for the same seed and leaves its inputs alone", () => {
    const input = randomInput(5, 12, 4, 8);
    const copy = { order: [...input.order], spare: [...input.spare] };
    expect(arrangeGradientWall(input)).toEqual(arrangeGradientWall(input));
    expect({ order: input.order, spare: input.spare }).toEqual(copy);
  });

  it("keeps covers by the same artist apart when asked, where the collection allows it", () => {
    // Six covers by three artists on a 2 by 2 wall: putting each artist on a diagonal works.
    const artists = ["a", "a", "b", "b", "c", "c"];
    const input = randomInput(9, 4, 2, 2, { artists, keepArtistsApart: true });
    expect(score(input, input.order).conflicts).toBe(2);
    const result = arrangeGradientWall(input);
    expect(result.artistConflicts).toBe(0);
    expect(score(input, result.order).conflicts).toBe(0);

    const bigger = randomInput(4, 16, 4, 12, {
      artists: Array.from({ length: 28 }, (_, c) => ` Artist ${Math.floor(c / 2)} `),
      keepArtistsApart: true,
    });
    const arranged = arrangeGradientWall(bigger);
    expect(arranged.artistConflicts).toBe(0);
    expect(score(bigger, arranged.order).conflicts).toBe(0);
  });

  it("never adds artist conflicts and reports the ones it cannot remove", () => {
    const input = randomInput(2, 4, 4, 0, {
      artists: ["x", "x", "x", "x"],
      keepArtistsApart: true,
    });
    const result = arrangeGradientWall(input);
    expect(result.artistConflicts).toBe(3);
    expect(score(input, result.order).conflicts).toBe(3);
  });

  it("ignores empty artist names", () => {
    const input = randomInput(6, 4, 4, 0, { artists: ["", "", "", ""], keepArtistsApart: true });
    expect(arrangeGradientWall(input).artistConflicts).toBe(0);
  });

  it("keeps the best gradient fit when neighbours do not count", () => {
    const input = randomInput(8, 6, 3, 0, { neighbourWeight: 0 });
    // Brute force the best order for the fit alone.
    let best = Infinity;
    const permute = (rest: number[], chosen: number[]) => {
      if (rest.length === 0) {
        best = Math.min(best, score(input, chosen).cost);
        return;
      }
      rest.forEach((c, i) => permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...chosen, c]));
    };
    permute([0, 1, 2, 3, 4, 5], []);
    expect(score(input, arrangeGradientWall(input).order).cost).toBeCloseTo(best, 9);
  });

  it("is quick enough for a 32-cover wall and a few hundred covers", () => {
    const input = randomInput(11, 32, 8, 268, { keepArtistsApart: true });
    const started = performance.now();
    arrangeGradientWall(input);
    expect(performance.now() - started).toBeLessThan(3000);
  });
});
