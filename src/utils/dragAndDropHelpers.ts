import { Album } from "@/types";
import { UniqueIdentifier } from "@dnd-kit/core";

type Location = { container: "grid" | "pool"; index: number };

/**
 * Finds which container holds a dragged or targeted album and its index there.
 *
 * @param id DnD Kit item identifier (`album-<id>`).
 * @param displayedAlbums Albums currently shown in the wall grid.
 * @param poolItems Albums currently outside the grid.
 * @returns The album's container and index, or null when it is in neither.
 */
function locateAlbum(
  id: UniqueIdentifier,
  displayedAlbums: Album[],
  poolItems: Album[]
): Location | null {
  const gridIndex = displayedAlbums.findIndex((album) => `album-${album.id}` === id);
  if (gridIndex !== -1) return { container: "grid", index: gridIndex };

  const poolIndex = poolItems.findIndex((album) => `album-${album.id}` === id);
  if (poolIndex !== -1) return { container: "pool", index: poolIndex };

  return null;
}

/**
 * Swaps the dragged album with the album it was dropped on, within or across the wall and pool.
 * Every other album keeps its position, and pinned albums never move.
 *
 * @param displayedAlbums Albums currently shown in the wall grid.
 * @param poolItems Albums currently outside the grid.
 * @param activeId Dragged item identifier.
 * @param overId Drop target identifier.
 * @param pinnedAlbums Set of pinned album ids that cannot be displaced.
 * @returns Updated grid and pool arrays; the inputs are returned unchanged when no swap applies.
 */
export function swapAlbums(
  displayedAlbums: Album[],
  poolItems: Album[],
  activeId: UniqueIdentifier,
  overId: UniqueIdentifier,
  pinnedAlbums: Set<string>
) {
  const unchanged = { newDisplayedAlbums: displayedAlbums, newPoolItems: poolItems };
  if (activeId === overId) return unchanged;

  const active = locateAlbum(activeId, displayedAlbums, poolItems);
  const over = locateAlbum(overId, displayedAlbums, poolItems);
  if (!active || !over) return unchanged;

  const containers = { grid: [...displayedAlbums], pool: [...poolItems] };
  const activeAlbum = containers[active.container][active.index];
  const overAlbum = containers[over.container][over.index];

  if (pinnedAlbums.has(String(activeAlbum.id)) || pinnedAlbums.has(String(overAlbum.id))) {
    return unchanged;
  }

  containers[active.container][active.index] = overAlbum;
  containers[over.container][over.index] = activeAlbum;

  return { newDisplayedAlbums: containers.grid, newPoolItems: containers.pool };
}
