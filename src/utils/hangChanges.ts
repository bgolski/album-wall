import type { Album, SharedWallState } from "@/types";
import { diffWalls } from "./diffWalls";
import { rehangSteps } from "./rehangSteps";
import { stepSentence } from "./rehangText";
import { wallOfHang, formatDay, type HangRecord } from "./hangHistory";
import { albumKey } from "./albumKey";

/**
 * What it takes to turn the wall hung last time into this one, for the hanging guide.
 */
export interface HangChanges {
  /** The day the last wall was hung, as formatDay shows it. */
  since: string;
  /** One sentence per step. */
  lines: string[];
}

/**
 * Computes the steps to change the wall from the last remembered hang into the current wall.
 *
 * @param lastHang The record from the most recent wall, or `undefined` if no wall has been hung yet.
 * @param wall The wall state to compare against.
 * @param collection The full collection, used to look up album titles.
 * @returns A guide describing the steps, or `null` when there is no prior wall or the walls match.
 */
export function hangChanges(
  lastHang: HangRecord | undefined,
  wall: SharedWallState,
  collection: readonly Album[]
): HangChanges | null {
  if (!lastHang) return null;

  const before = wallOfHang(lastHang, wall.username, wall.columns);
  const steps = rehangSteps(diffWalls(before, wall));

  if (steps.length === 0) return null;

  const byId = new Map(collection.map((album) => [albumKey(album), album]));
  const titleOf = (id: string) => byId.get(id)?.title || "An album no longer in the collection";
  const where = (spot: { row: number; column: number }) => `R${spot.row} C${spot.column}`;

  return {
    since: formatDay(lastHang.date),
    lines: steps.map((step) => stepSentence(step, titleOf, where)),
  };
}
