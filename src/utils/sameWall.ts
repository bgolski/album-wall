import type { SharedWallState } from "@/types";

/**
 * Whether two walls are the same: the same size, the same albums in the same spots and the same
 * pins.
 *
 * @param first One wall.
 * @param second The other wall.
 * @returns True when nothing differs.
 */
export function sameWall(first: SharedWallState, second: SharedWallState): boolean {
  if (first.rows !== second.rows || first.columns !== second.columns) return false;
  if (first.wallAlbumIds.length !== second.wallAlbumIds.length) return false;
  if (first.wallAlbumIds.some((id, at) => id !== second.wallAlbumIds[at])) return false;
  const pinned = new Set(second.pinnedAlbumIds);
  return (
    first.pinnedAlbumIds.length === pinned.size &&
    first.pinnedAlbumIds.every((id) => pinned.has(id))
  );
}
