import { arrayMove } from "@dnd-kit/sortable";
import { Album } from "@/types";
import { UniqueIdentifier } from "@dnd-kit/core";

export function getContainerType(id: UniqueIdentifier, displayedAlbums: Album[]): "grid" | "pool" {
  return displayedAlbums.some((item) => `album-${item.id}` === id) ? "grid" : "pool";
}

export function reorderWithinGrid(
  displayedAlbums: Album[],
  activeAlbumId: string,
  overAlbumId: string,
  pinnedAlbums: Set<string>
) {
  // Get the subset of albums that are not pinned
  const unpinnedAlbums = displayedAlbums.filter((album) => !pinnedAlbums.has(String(album.id)));

  // Find the indices of the dragged and target items within the unpinned subset
  const unpinnedActiveIndex = unpinnedAlbums.findIndex(
    (album) => String(album.id) === activeAlbumId
  );
  const unpinnedOverIndex = unpinnedAlbums.findIndex((album) => String(album.id) === overAlbumId);

  // Reorder just the unpinned albums
  const reorderedUnpinned = arrayMove(unpinnedAlbums, unpinnedActiveIndex, unpinnedOverIndex);

  // Create the new album order by inserting pinned albums at their fixed positions
  const newDisplayedAlbums: Album[] = [];

  // For each position in the grid, determine what album should be there
  for (let i = 0; i < displayedAlbums.length; i++) {
    const originalAlbumAtPosition = displayedAlbums[i];
    const albumId = String(originalAlbumAtPosition.id);

    // If this position had a pinned album, keep it there
    if (pinnedAlbums.has(albumId)) {
      newDisplayedAlbums.push(originalAlbumAtPosition);
    } else {
      // Otherwise, take the next unpinned album from our reordered list
      if (reorderedUnpinned.length > 0) {
        newDisplayedAlbums.push(reorderedUnpinned.shift()!);
      }
    }
  }

  // If we have any remaining unpinned albums (unlikely but for safety), add them at the end
  if (reorderedUnpinned.length > 0) {
    newDisplayedAlbums.push(...reorderedUnpinned);
  }

  return newDisplayedAlbums;
}

export function swapBetweenContainers(
  displayedAlbums: Album[],
  poolItems: Album[],
  activeIndex: number,
  overIndex: number,
  activeContainer: "grid" | "pool",
  overContainer: "grid" | "pool",
  pinnedAlbums: Set<string>
) {
  const activeItem =
    activeContainer === "grid" ? displayedAlbums[activeIndex] : poolItems[activeIndex];
  const overItem = overContainer === "grid" ? displayedAlbums[overIndex] : poolItems[overIndex];

  // Create new arrays with the items swapped
  const newDisplayedAlbums = [...displayedAlbums];
  const newPoolItems = [...poolItems];

  if (activeContainer === "grid") {
    // Moving from grid to pool means unpinning the album
    // Remove from grid
    newDisplayedAlbums.splice(activeIndex, 1);
    // Find the right insertion spot in the pool
    newPoolItems.splice(overIndex, 0, activeItem);

    // Insert the pool item into the grid, respecting pinned positions
    let insertIndex = overIndex;
    while (
      insertIndex < newDisplayedAlbums.length &&
      pinnedAlbums.has(String(newDisplayedAlbums[insertIndex].id))
    ) {
      insertIndex++;
    }

    // Insert at the found position or at the end if all remaining positions are pinned
    if (insertIndex < newDisplayedAlbums.length) {
      newDisplayedAlbums.splice(insertIndex, 0, overItem);
    } else {
      newDisplayedAlbums.push(overItem);
    }
  } else {
    // Moving from pool to grid
    // Remove from pool
    newPoolItems.splice(activeIndex, 1);

    // Find the right insertion spot in the grid, respecting pinned positions
    if (pinnedAlbums.has(String(overItem.id))) {
      // Can't replace a pinned item, find the next available unpinned spot
      let insertIndex = overIndex;
      while (
        insertIndex < newDisplayedAlbums.length &&
        pinnedAlbums.has(String(newDisplayedAlbums[insertIndex].id))
      ) {
        insertIndex++;
      }

      // Insert at the found position or at the end if all remaining positions are pinned
      if (insertIndex < newDisplayedAlbums.length) {
        newDisplayedAlbums.splice(insertIndex, 0, activeItem);
      } else {
        newDisplayedAlbums.push(activeItem);
      }
    } else {
      // Normal case, just insert at the target position
      newDisplayedAlbums.splice(overIndex, 0, activeItem);
    }
  }

  return { newDisplayedAlbums, newPoolItems };
}
