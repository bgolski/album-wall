import { useState } from "react";
import { Album } from "@/types";

export type SortOption = "none" | "artist" | "genre";

/**
 * Tracks the active sort mode and exposes sorting behavior that respects pinned album positions.
 *
 * @returns Current sort option plus actions for updating and applying the sort.
 */
export function useAlbumSorting() {
  const [sortOption, setSortOption] = useState<SortOption>("none");

  /**
   * Sorts albums by the active sort option while preserving pinned albums at their current indices.
   *
   * @param albumsToSort Albums to sort.
   * @param pinnedAlbums Set of pinned album ids that must remain fixed in place.
   * @returns Albums sorted according to the active sort option.
   */
  const sortAlbums = (albumsToSort: Album[], pinnedAlbums: Set<string>) => {
    if (sortOption === "none") return albumsToSort;

    // Keep pinned albums in their positions during sort
    if (pinnedAlbums.size > 0) {
      const pinnedIndices = new Map<string, number>();
      albumsToSort.forEach((album, index) => {
        if (pinnedAlbums.has(String(album.id))) {
          pinnedIndices.set(String(album.id), index);
        }
      });

      // Sort non-pinned albums
      const nonPinnedAlbums = albumsToSort.filter((album) => !pinnedAlbums.has(String(album.id)));
      const sortedNonPinned = [...nonPinnedAlbums].sort((a, b) => {
        if (sortOption === "artist") {
          const artistA = a.artist || "";
          const artistB = b.artist || "";
          return artistA.localeCompare(artistB);
        } else if (sortOption === "genre") {
          const genreA =
            typeof a.genre === "string" ? a.genre : Array.isArray(a.genre) ? a.genre[0] || "" : "";
          const genreB =
            typeof b.genre === "string" ? b.genre : Array.isArray(b.genre) ? b.genre[0] || "" : "";
          return String(genreA).localeCompare(String(genreB));
        }
        return 0;
      });

      // Create result array with all albums
      const result = new Array(albumsToSort.length);

      // Place pinned albums at their original positions
      pinnedIndices.forEach((index, albumId) => {
        const album = albumsToSort.find((a) => String(a.id) === albumId);
        if (album) {
          result[index] = album;
        }
      });

      // Fill empty slots with sorted non-pinned albums
      let nonPinnedIndex = 0;
      for (let i = 0; i < result.length; i++) {
        if (!result[i] && nonPinnedIndex < sortedNonPinned.length) {
          result[i] = sortedNonPinned[nonPinnedIndex++];
        }
      }

      return result.filter(Boolean);
    }

    // Regular sort if no pins
    return [...albumsToSort].sort((a, b) => {
      if (sortOption === "artist") {
        const artistA = a.artist || "";
        const artistB = b.artist || "";
        return artistA.localeCompare(artistB);
      } else if (sortOption === "genre") {
        const genreA =
          typeof a.genre === "string" ? a.genre : Array.isArray(a.genre) ? a.genre[0] || "" : "";
        const genreB =
          typeof b.genre === "string" ? b.genre : Array.isArray(b.genre) ? b.genre[0] || "" : "";
        return String(genreA).localeCompare(String(genreB));
      }
      return 0;
    });
  };

  /**
   * Updates the active sort option used by {@link sortAlbums}.
   *
   * @param option Sort mode to apply.
   */
  const handleSortChange = (option: SortOption) => {
    setSortOption(option);
  };

  return {
    sortOption,
    handleSortChange,
    sortAlbums,
  };
}
