import { describe, expect, it } from "vitest";
import type { SharedWallState } from "@/types";
import { diffWalls } from "./diffWalls";
import { orderWallSteps, type WallStep } from "./wallSteps";

const wall = (columns: number, ids: string[]): SharedWallState => ({
  v: 1,
  username: "someone",
  rows: Math.ceil(ids.length / columns),
  columns,
  wallAlbumIds: ids,
  pinnedAlbumIds: [],
});

const at = (position: { row: number; column: number }) => `${position.row},${position.column}`;

// Plays the steps on a model of the wall and checks nothing is ever hung on an occupied spot,
// and that the result is the wall wanted.
function play(from: SharedWallState, to: SharedWallState, steps: WallStep[]) {
  const spots = new Map<string, string>();
  from.wallAlbumIds.forEach((id, i) =>
    spots.set(at({ row: Math.floor(i / from.columns) + 1, column: (i % from.columns) + 1 }), id)
  );
  const aside = new Set<string>();
  for (const step of steps) {
    if (step.kind === "take-down") {
      expect(spots.get(at(step.from))).toBe(step.id);
      spots.delete(at(step.from));
    } else if (step.kind === "set-aside") {
      expect(spots.get(at(step.from))).toBe(step.id);
      spots.delete(at(step.from));
      aside.add(step.id);
    } else if (step.kind === "move") {
      expect(spots.has(at(step.to))).toBe(false);
      if (step.from) {
        expect(spots.get(at(step.from))).toBe(step.id);
        spots.delete(at(step.from));
      } else {
        expect(aside.delete(step.id)).toBe(true);
      }
      spots.set(at(step.to), step.id);
    } else {
      expect(spots.has(at(step.to))).toBe(false);
      spots.set(at(step.to), step.id);
    }
  }
  const wanted = new Map<string, string>();
  to.wallAlbumIds.forEach((id, i) =>
    wanted.set(at({ row: Math.floor(i / to.columns) + 1, column: (i % to.columns) + 1 }), id)
  );
  expect(spots).toEqual(wanted);
  expect(aside.size).toBe(0);
}

describe("orderWallSteps", () => {
  it("takes covers down first, moves next and hangs new ones last", () => {
    const from = wall(3, ["a", "b", "c", "d"]);
    const to = wall(3, ["x", "a", "c", "d"]);
    const steps = orderWallSteps(diffWalls(from, to));
    expect(steps.map((step) => step.kind)).toEqual(["take-down", "move", "hang-up"]);
    play(from, to, steps);
  });

  it("orders a chain of moves so each spot is free before it is used", () => {
    // a moves into b's spot, b into c's, c into an empty one.
    const from = wall(4, ["a", "b", "c", "x"]);
    const to = wall(4, ["y", "a", "b", "c"]);
    const steps = orderWallSteps(diffWalls(from, to));
    expect(steps.filter((step) => step.kind === "move").map((step) => step.id)).toEqual([
      "c",
      "b",
      "a",
    ]);
    play(from, to, steps);
  });

  it("sets one cover aside to break a swap", () => {
    const from = wall(2, ["a", "b"]);
    const to = wall(2, ["b", "a"]);
    const steps = orderWallSteps(diffWalls(from, to));
    expect(steps[0]).toEqual({ kind: "set-aside", id: "b", from: { row: 1, column: 2 } });
    expect(steps.filter((step) => step.kind === "set-aside")).toHaveLength(1);
    play(from, to, steps);
  });

  it("handles a long loop and a shuffled wall with a single spot set aside per loop", () => {
    const ids = Array.from({ length: 12 }, (_, i) => `c${i}`);
    const rotated = [...ids.slice(1), ids[0]!];
    const steps = orderWallSteps(diffWalls(wall(4, ids), wall(4, rotated)));
    expect(steps.filter((step) => step.kind === "set-aside")).toHaveLength(1);
    play(wall(4, ids), wall(4, rotated), steps);

    const shuffled = ["c3", "c7", "c0", "c11", "c5", "c1", "c9", "c2", "c10", "c4", "c8", "c6"];
    play(
      wall(4, ids),
      wall(4, shuffled),
      orderWallSteps(diffWalls(wall(4, ids), wall(4, shuffled)))
    );
  });

  it("gives nothing to do for identical walls", () => {
    expect(orderWallSteps(diffWalls(wall(3, ["a", "b"]), wall(3, ["a", "b"])))).toEqual([]);
  });

  it("works when the wall changes size", () => {
    const from = wall(2, ["a", "b", "c", "d"]);
    const to = wall(4, ["d", "c", "b", "a"]);
    play(from, to, orderWallSteps(diffWalls(from, to)));
  });
});
