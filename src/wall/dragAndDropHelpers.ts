import { Album } from "@/types/index";
import { UniqueIdentifier } from "@dnd-kit/core";
import { albumKey, dragId } from "./albumKey";

/**
 * Swaps the dragged album with the album it was dropped on, anywhere on the wall or in the pool;
 * every other album keeps its place and pinned albums never move.
 *
 * @param albums The wall followed by the pool (the combined list callers already build).
 * @param pinnedAlbums Set of pinned album keys that cannot be displaced.
 * @returns The new order, or null when nothing moves (same album, unknown id, or a pinned album).
 */
export function swapAlbums(
  albums: Album[],
  activeId: UniqueIdentifier,
  overId: UniqueIdentifier,
  pinnedAlbums: Set<string>
): Album[] | null {
  if (activeId === overId) return null;

  const activeIndex = albums.findIndex((album) => dragId(album) === activeId);
  const overIndex = albums.findIndex((album) => dragId(album) === overId);
  if (activeIndex === -1 || overIndex === -1) return null;

  const activeAlbum = albums[activeIndex]!;
  const overAlbum = albums[overIndex]!;

  if (pinnedAlbums.has(albumKey(activeAlbum)) || pinnedAlbums.has(albumKey(overAlbum))) {
    return null;
  }

  const result = [...albums];
  result[activeIndex] = overAlbum;
  result[overIndex] = activeAlbum;
  return result;
}
