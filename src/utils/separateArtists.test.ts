import { describe, expect, it } from "vitest";
import { wallSeamIndexes } from "./colorBasics";
import { separateSameArtist } from "./separateArtists";

type Input = Parameters<typeof separateSameArtist>[0];

const zero = () => 0;

function conflicts(order: number[], artists: string[], columns: number) {
  const key = (cover: number) => artists[cover]!.trim().toLowerCase();
  return wallSeamIndexes(order.length, columns).filter(([a, b]) => {
    const x = key(order[a]!);
    return x !== "" && x === key(order[b]!);
  });
}

function input(overrides: Partial<Input> & Pick<Input, "order" | "artists">): Input {
  return {
    spare: [],
    pinned: overrides.order.map(() => false),
    columns: overrides.order.length,
    cost: zero,
    ...overrides,
  };
}

describe("separateSameArtist", () => {
  it("leaves a wall with no touching same-artist covers exactly as it was", () => {
    const result = separateSameArtist(
      input({ order: [0, 1, 2], spare: [3], artists: ["a", "b", "a", "c"], columns: 3 })
    );
    expect(result).toEqual({ order: [0, 1, 2], spare: [3] });
  });

  it("replaces one of two touching covers with a spare, the lower position first", () => {
    const result = separateSameArtist(
      input({ order: [0, 1, 2], spare: [3], artists: ["a", "a", "b", "c"], columns: 3 })
    );
    expect(result.order).toEqual([3, 1, 2]);
    expect(result.spare).toEqual([0]);
  });

  it("prefers a swap on the wall when that costs less than a spare", () => {
    const result = separateSameArtist(
      input({
        order: [0, 1, 2],
        spare: [3],
        artists: ["a", "a", "b", "c"],
        columns: 3,
        cost: (_position, cover) => (cover === 3 ? 10 : 0),
      })
    );
    expect(result.order).toEqual([0, 2, 1]);
    expect(result.spare).toEqual([3]);
  });

  it("picks the spare and position with the smallest rise in total cost", () => {
    const table: Record<string, number> = { "0:2": 5, "0:3": 4, "1:2": 3, "1:3": 6 };
    const result = separateSameArtist(
      input({
        order: [0, 1],
        spare: [2, 3],
        artists: ["a", "a", "b", "c"],
        columns: 2,
        cost: (position, cover) => table[`${position}:${cover}`] ?? 0,
      })
    );
    expect(result.order).toEqual([0, 2]);
    expect([...result.spare].sort()).toEqual([1, 3]);
  });

  it("rejects a fix that would create a new same-artist pair", () => {
    // Replacing position 1 with spare 3 would put two "b" covers side by side; position 0 is safe.
    const result = separateSameArtist(
      input({ order: [0, 1, 2], spare: [3], artists: ["a", "a", "b", "b"], columns: 3 })
    );
    expect(result.order).toEqual([3, 1, 2]);
    expect(conflicts(result.order, ["a", "a", "b", "b"], 3)).toEqual([]);
  });

  it("never changes a pinned position", () => {
    const swapOnly = separateSameArtist(
      input({
        order: [0, 1, 2],
        artists: ["a", "a", "b"],
        columns: 3,
        pinned: [true, false, false],
      })
    );
    expect(swapOnly.order).toEqual([0, 2, 1]);

    const bothPinned = separateSameArtist(
      input({
        order: [0, 1, 2],
        spare: [3],
        artists: ["a", "a", "b", "c"],
        columns: 3,
        pinned: [true, true, false],
      })
    );
    expect(bothPinned).toEqual({ order: [0, 1, 2], spare: [3] });
  });

  it("leaves a conflict it cannot fix and still fixes the others", () => {
    const sameArtist = separateSameArtist(
      input({ order: [0, 1, 2, 3], artists: ["a", "a", "a", "a"], columns: 4 })
    );
    expect(sameArtist.order).toEqual([0, 1, 2, 3]);

    const mixed = separateSameArtist(
      input({
        order: [0, 1, 2, 3, 4],
        spare: [5],
        artists: ["x", "x", "y", "z", "z", "w"],
        columns: 5,
      })
    );
    expect(mixed.order).toEqual([5, 1, 2, 0, 4]);
    expect(mixed.spare).toEqual([3]);
  });

  it("compares artists ignoring case and surrounding spaces, and ignores empty artists", () => {
    const result = separateSameArtist(
      input({
        order: [0, 1, 2, 3],
        spare: [4],
        artists: ["Radiohead ", "radiohead", "", "", "Other"],
        columns: 4,
      })
    );
    expect(result.order).toEqual([4, 1, 2, 3]);
    expect(result.spare).toEqual([0]);
  });

  it("gives the same answer each time and leaves its inputs alone", () => {
    const original = input({
      order: [0, 1, 2],
      spare: [3],
      artists: ["a", "a", "b", "c"],
      columns: 3,
    });
    const frozen = JSON.stringify({ ...original, cost: undefined });
    expect(separateSameArtist(original)).toEqual(separateSameArtist(original));
    expect(JSON.stringify({ ...original, cost: undefined })).toBe(frozen);
  });

  it("never adds conflicts, never moves pinned covers, and keeps every cover exactly once", () => {
    for (let round = 0; round < 12; round += 1) {
      const artists = Array.from({ length: 36 }, (_, c) => `artist ${(c * 7 + round * 3) % 6}`);
      const order = Array.from({ length: 16 }, (_, p) => p);
      const spare = Array.from({ length: 20 }, (_, i) => 16 + i);
      const pinned = order.map((p) => p % 5 === 0);
      const result = separateSameArtist({
        order,
        spare,
        artists,
        pinned,
        columns: 4,
        cost: (position, cover) => ((position * 31 + cover * 17) % 11) / 10,
      });
      expect(conflicts(result.order, artists, 4).length).toBeLessThanOrEqual(
        conflicts(order, artists, 4).length
      );
      pinned.forEach((isPinned, p) => {
        if (isPinned) expect(result.order[p]).toBe(order[p]);
      });
      expect([...result.order, ...result.spare].sort((x, y) => x - y)).toEqual(
        Array.from({ length: 36 }, (_, c) => c)
      );
    }
  });
});
