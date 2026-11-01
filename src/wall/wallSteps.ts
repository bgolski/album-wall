import type { WallDiff, WallPosition } from "./diffWalls";

/** One thing to do at the real wall. "set-aside" takes a cover down for a moment to break a loop. */
export type WallStep =
  | { kind: "take-down"; id: string; from: WallPosition }
  | { kind: "set-aside"; id: string; from: WallPosition }
  | { kind: "move"; id: string; from: WallPosition | null; to: WallPosition }
  | { kind: "hang-up"; id: string; to: WallPosition };

const key = (position: WallPosition) => `${position.row},${position.column}`;
const readingOrder = (a: WallPosition, b: WallPosition) => a.row - b.row || a.column - b.column;

/**
 * Puts the changes between two walls in an order that can be followed at the real wall without
 * ever hanging a cover where another still is: covers come down first, then each move happens
 * once its new spot is free, then new covers go up. When moves block each other in a loop, one
 * cover is set aside to free a spot and hung in its new place when that spot is free.
 *
 * @param diff Changes from the wall now to the wall wanted.
 * @returns The steps, in order. A move with `from: null` hangs a cover that was set aside.
 */
export function orderWallSteps(diff: WallDiff): WallStep[] {
  const steps: WallStep[] = [];
  const occupied = new Set<string>();
  for (const item of diff.moved) occupied.add(key(item.from));
  // Covers that stay also occupy their spots, but no change ever targets them.

  for (const item of [...diff.takeDown].sort((a, b) => readingOrder(a.from, b.from))) {
    steps.push({ kind: "take-down", id: item.id, from: item.from });
  }

  type Pending = { id: string; from: WallPosition | null; to: WallPosition };
  let pending: Pending[] = [...diff.moved]
    .sort((a, b) => readingOrder(a.to, b.to))
    .map((item) => ({ id: item.id, from: item.from, to: item.to }));

  while (pending.length > 0) {
    const ready = pending.find((item) => !occupied.has(key(item.to)));
    if (ready) {
      steps.push({ kind: "move", id: ready.id, from: ready.from, to: ready.to });
      if (ready.from) occupied.delete(key(ready.from));
      occupied.add(key(ready.to));
      pending = pending.filter((item) => item !== ready);
      continue;
    }
    // Every remaining move waits for another: set the first one aside to break the loop.
    const first = pending.find((item) => item.from !== null)!;
    steps.push({ kind: "set-aside", id: first.id, from: first.from! });
    occupied.delete(key(first.from!));
    pending = pending.map((item) => (item === first ? { ...item, from: null } : item));
  }

  for (const item of [...diff.hangUp].sort((a, b) => readingOrder(a.to, b.to))) {
    steps.push({ kind: "hang-up", id: item.id, to: item.to });
  }
  return steps;
}
