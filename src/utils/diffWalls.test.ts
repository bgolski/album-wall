import { describe, expect, it } from "vitest";
import type { SharedWallState } from "@/types";
import { diffWalls } from "./diffWalls";

const wall = (columns: number, ids: string[]): SharedWallState => ({
  v: 1,
  username: "someone",
  rows: Math.max(1, Math.ceil(ids.length / columns)),
  columns,
  wallAlbumIds: ids,
  pinnedAlbumIds: [],
});

describe("diffWalls", () => {
  it("reports nothing for identical walls", () => {
    const same = wall(3, ["a", "b", "c", "d", "e", "f"]);
    expect(diffWalls(same, same)).toEqual({ takeDown: [], hangUp: [], moved: [], unchanged: 6 });
  });

  it("reports a swap as two moves", () => {
    const result = diffWalls(wall(3, ["a", "b", "c", "d"]), wall(3, ["a", "d", "c", "b"]));
    expect(result.unchanged).toBe(2);
    expect(result.takeDown).toEqual([]);
    expect(result.hangUp).toEqual([]);
    expect(result.moved).toEqual([
      { id: "d", from: { row: 2, column: 1 }, to: { row: 1, column: 2 } },
      { id: "b", from: { row: 1, column: 2 }, to: { row: 2, column: 1 } },
    ]);
  });

  it("reports a replaced cover as one take-down and one hang-up at the same place", () => {
    const result = diffWalls(wall(2, ["a", "b", "c", "d"]), wall(2, ["a", "b", "x", "d"]));
    expect(result.takeDown).toEqual([{ id: "c", from: { row: 2, column: 1 } }]);
    expect(result.hangUp).toEqual([{ id: "x", to: { row: 2, column: 1 } }]);
    expect(result.moved).toEqual([]);
    expect(result.unchanged).toBe(3);
  });

  it("uses each wall's own width when the walls differ in size", () => {
    const result = diffWalls(wall(2, ["a", "b", "c", "d"]), wall(4, ["a", "b", "c", "d"]));
    expect(result.moved).toEqual([
      { id: "c", from: { row: 2, column: 1 }, to: { row: 1, column: 3 } },
      { id: "d", from: { row: 2, column: 2 }, to: { row: 1, column: 4 } },
    ]);
    expect(result.unchanged).toBe(2);
  });

  it("does not produce NaN positions for a wall with no columns", () => {
    const result = diffWalls(wall(0, ["a", "b"]), wall(2, ["a", "c"]));
    expect(JSON.stringify(result)).not.toContain("null");
    expect(result.takeDown).toEqual([{ id: "b", from: { row: 2, column: 1 } }]);
  });

  it("handles empty walls", () => {
    expect(diffWalls(wall(3, []), wall(3, []))).toEqual({
      takeDown: [],
      hangUp: [],
      moved: [],
      unchanged: 0,
    });
    const result = diffWalls(wall(2, []), wall(2, ["a", "b", "c"]));
    expect(result.hangUp).toEqual([
      { id: "a", to: { row: 1, column: 1 } },
      { id: "b", to: { row: 1, column: 2 } },
      { id: "c", to: { row: 2, column: 1 } },
    ]);
    expect(
      diffWalls(wall(2, ["a", "b", "c"]), wall(2, [])).takeDown.map((item) => item.id)
    ).toEqual(["a", "b", "c"]);
  });

  it("orders take-downs by their old position and hang-ups by their new one", () => {
    const result = diffWalls(
      wall(3, ["a", "b", "c", "d", "e", "f"]),
      wall(3, ["x", "b", "y", "d", "z", "f"])
    );
    expect(result.takeDown.map((item) => item.id)).toEqual(["a", "c", "e"]);
    expect(result.hangUp.map((item) => item.id)).toEqual(["x", "y", "z"]);
  });

  it("counts a cover that stays in the same row and column as unchanged even if the width differs", () => {
    const result = diffWalls(wall(2, ["a", "b"]), wall(5, ["a", "b", "c"]));
    expect(result.unchanged).toBe(2);
    expect(result.hangUp).toEqual([{ id: "c", to: { row: 1, column: 3 } }]);
  });
});
