import { useCallback, useState } from "react";
import { Album } from "@/types";

/**
 * Tracks pinned albums and exposes helpers for toggling pins within the displayed grid.
 *
 * @param initialPinnedAlbumIds Album ids that should start pinned.
 * @returns Pin state plus helpers for toggling, bulk pinning, and cleanup.
 */
export function useAlbumPinning(initialPinnedAlbumIds: string[] = []) {
  const [pinnedAlbums, setPinnedAlbums] = useState<Set<string>>(new Set(initialPinnedAlbumIds));

  /**
   * Toggles the pinned state for a single album id.
   *
   * @param albumId Album id to pin or unpin.
   */
  const togglePinAlbum = (albumId: string) => {
    setPinnedAlbums((prevPinned) => {
      const newPinned = new Set(prevPinned);
      if (newPinned.has(albumId)) {
        newPinned.delete(albumId);
      } else {
        newPinned.add(albumId);
      }
      return newPinned;
    });
  };

  /**
   * Pins every displayed album, or unpins them all if they are already all pinned.
   *
   * @param displayedAlbums Albums currently shown in the wall grid.
   */
  const togglePinAll = (displayedAlbums: Album[]) => {
    const allPinned = displayedAlbums.every((album) => pinnedAlbums.has(String(album.id)));

    if (allPinned) {
      // Unpin all displayed albums
      setPinnedAlbums((prev) => {
        const newPinned = new Set(prev);
        displayedAlbums.forEach((album) => {
          newPinned.delete(String(album.id));
        });
        return newPinned;
      });
    } else {
      // Pin all displayed albums
      setPinnedAlbums((prev) => {
        const newPinned = new Set(prev);
        displayedAlbums.forEach((album) => {
          newPinned.add(String(album.id));
        });
        return newPinned;
      });
    }
  };

  /**
   * Removes pins for albums that are no longer eligible to stay pinned in the grid.
   *
   * @param albumIds Album ids whose pinned state should be cleared.
   */
  const removePinsForAlbums = (albumIds: string[]) => {
    setPinnedAlbums((prevPinned) => {
      const newPinned = new Set(prevPinned);
      albumIds.forEach((id) => newPinned.delete(id));
      return newPinned;
    });
  };

  /**
   * Replaces the full pinned album set, typically when hydrating shared wall state.
   *
   * @param albumIds Album ids that should be pinned after replacement.
   */
  const replacePinnedAlbums = useCallback((albumIds: string[]) => {
    setPinnedAlbums(new Set(albumIds));
  }, []);

  /**
   * Checks whether every displayed album is currently pinned.
   *
   * @param displayedAlbums Albums currently shown in the wall grid.
   * @returns True when the displayed grid is non-empty and every album is pinned.
   */
  const areAllPinned = (displayedAlbums: Album[]) => {
    return (
      displayedAlbums.length > 0 &&
      displayedAlbums.every((album) => pinnedAlbums.has(String(album.id)))
    );
  };

  return {
    pinnedAlbums,
    togglePinAlbum,
    togglePinAll,
    removePinsForAlbums,
    replacePinnedAlbums,
    areAllPinned,
  };
}
