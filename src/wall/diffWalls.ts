import type { SharedWallState } from "@/types/index";

/**
 * Position on a wall, using 1‑based row and column numbers.
 */
export interface WallPosition {
  /** 1‑based row number */
  row: number;
  /** 1‑based column number */
  column: number;
}

/**
 * Result of comparing two wall states.
 */
export interface WallDiff {
  /**
   * Covers that existed in the source wall but not in the target wall.
   * The `from` property represents the original position on the source wall.
   */
  takeDown: { id: string; from: WallPosition }[];

  /**
   * Covers that appear in the target wall but not in the source wall.
   * The `to` property represents the position on the target wall.
   */
  hangUp: { id: string; to: WallPosition }[];

  /**
   * Covers that exist in both walls but have moved to a different position.
   * Includes both the original `from` and the new `to` positions.
   */
  moved: { id: string; from: WallPosition; to: WallPosition }[];

  /**
   * Number of covers that are unchanged, i.e. present in both walls at the same
   * row and column.
   */
  unchanged: number;
}

/**
 * Compute the difference between two wall states.
 *
 * The algorithm follows these rules:
 *   * `takeDown` lists ids present in `from` but not in `to`, preserving the
 *     order from the source wall.
 *   * `hangUp` lists ids present in `to` but not in `from`, preserving the
 *     order from the target wall.
 *   * `moved` lists ids present in both walls that have different row or
 *     column. The order follows the target wall.
 *   * `unchanged` counts ids that appear in the same row and column in both
 *     walls. The width of each wall (its columns count) is used when
 *     computing positions.
 *
 * The function never mutates its arguments.
 */
export function diffWalls(from: SharedWallState, to: SharedWallState): WallDiff {
  // Build index maps for fast lookup.
  const fromIndex = new Map<string, number>();
  from.wallAlbumIds.forEach((id, idx) => fromIndex.set(id, idx));

  const toIndex = new Map<string, number>();
  to.wallAlbumIds.forEach((id, idx) => toIndex.set(id, idx));

  const takeDown: WallDiff["takeDown"] = [];
  const hangUp: WallDiff["hangUp"] = [];
  const moved: WallDiff["moved"] = [];
  let unchanged = 0;

  const fromColumns = from.columns;
  const toColumns = to.columns;

  // Helper to compute position.
  // A width below 1 is treated as 1 so a damaged wall never produces NaN positions.
  const pos = (idx: number, columns: number): WallPosition => {
    const width = Math.max(1, columns);
    return { row: Math.floor(idx / width) + 1, column: (idx % width) + 1 };
  };

  // Take-downs: iterate source order.
  from.wallAlbumIds.forEach((id, idx) => {
    if (!toIndex.has(id)) {
      takeDown.push({ id, from: pos(idx, fromColumns) });
    }
  });

  // Hang-ups: iterate target order.
  to.wallAlbumIds.forEach((id, idx) => {
    if (!fromIndex.has(id)) {
      hangUp.push({ id, to: pos(idx, toColumns) });
    }
  });

  // Moves and unchanged.
  to.wallAlbumIds.forEach((id, idxTo) => {
    const idxFrom = fromIndex.get(id);
    if (idxFrom !== undefined) {
      const fromPos = pos(idxFrom, fromColumns);
      const toPos = pos(idxTo, toColumns);
      if (fromPos.row === toPos.row && fromPos.column === toPos.column) {
        unchanged++;
      } else {
        moved.push({ id, from: fromPos, to: toPos });
      }
    }
  });

  return { takeDown, hangUp, moved, unchanged };
}
