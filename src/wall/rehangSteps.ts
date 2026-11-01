import type { WallDiff, WallPosition } from "./diffWalls";
import { orderWallSteps, type WallStep } from "./wallSteps";

/**
 * One thing to do at the real wall when hanging a saved wall: the steps of
 * {@link orderWallSteps}, where taking a cover down and hanging a different one in the same spot
 * is a single "replace".
 */
export type RehangStep =
  WallStep | { kind: "replace"; id: string; outId: string; at: WallPosition };

const key = (position: WallPosition) => `${position.row},${position.column}`;

/**
 * The steps to hang a saved wall one at a time. A cover that comes down for good, where another
 * that is not on the wall now goes up, becomes one "replace" at that spot, in the place of the
 * take-down. That is always safe: nothing else is ever moved into a spot whose new cover comes
 * from off the wall.
 *
 * @param diff Changes from the wall now to the saved wall.
 * @returns The steps, in order.
 */
export function rehangSteps(diff: WallDiff): RehangStep[] {
  const steps = orderWallSteps(diff);
  const hangingAt = new Map<string, string>();
  for (const step of steps) if (step.kind === "hang-up") hangingAt.set(key(step.to), step.id);

  const merged = new Set<string>();
  const result: RehangStep[] = [];
  for (const step of steps) {
    if (step.kind === "take-down") {
      const incoming = hangingAt.get(key(step.from));
      if (incoming !== undefined) {
        merged.add(key(step.from));
        result.push({ kind: "replace", id: incoming, outId: step.id, at: step.from });
        continue;
      }
    }
    if (step.kind === "hang-up" && merged.has(key(step.to))) continue;
    result.push(step);
  }
  return result;
}
