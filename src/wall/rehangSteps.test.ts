import { describe, expect, it } from "vitest";
import type { SharedWallState } from "@/types/index";
import { diffWalls } from "./diffWalls";
import { rehangSteps } from "./rehangSteps";

const wall = (ids: string[]): SharedWallState => ({
  v: 1,
  username: "someone",
  rows: 1,
  columns: ids.length,
  wallAlbumIds: ids,
  pinnedAlbumIds: [],
});

const steps = (from: string[], to: string[]) => rehangSteps(diffWalls(wall(from), wall(to)));

describe("rehangSteps", () => {
  it("has nothing to do when the walls match", () => {
    expect(steps(["1", "2", "3"], ["1", "2", "3"])).toEqual([]);
  });

  it("replaces a cover with one from off the wall in a single step", () => {
    expect(steps(["1", "2", "3"], ["1", "9", "3"])).toEqual([
      { kind: "replace", id: "9", outId: "2", at: { row: 1, column: 2 } },
    ]);
  });

  it("does one step per spot when every cover is swapped for a new one", () => {
    const result = steps(["1", "2", "3"], ["7", "8", "9"]);
    expect(result.map((step) => step.kind)).toEqual(["replace", "replace", "replace"]);
    expect(result.map((step) => (step.kind === "replace" ? step.id : ""))).toEqual(["7", "8", "9"]);
  });

  it("keeps covers that only move as moves, and still replaces the rest", () => {
    // 1 and 2 swap places; 3 is replaced by 9.
    const result = steps(["1", "2", "3"], ["2", "1", "9"]);
    expect(result.some((step) => step.kind === "replace")).toBe(true);
    expect(result.some((step) => step.kind === "move" || step.kind === "set-aside")).toBe(true);
    expect(result.filter((step) => step.kind === "hang-up")).toEqual([]);
  });

  it("hangs a cover where nothing was, and takes one down where nothing goes", () => {
    const result = rehangSteps(diffWalls(wall(["1", "2"]), wall(["1"])));
    expect(result).toEqual([{ kind: "take-down", id: "2", from: { row: 1, column: 2 } }]);
  });
});
