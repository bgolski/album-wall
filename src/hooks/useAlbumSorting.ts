import { useState } from "react";
import { Album } from "@/types";

export type SortOption = "none" | "artist" | "genre";

/**
 * Derives the comparison key for an album under a given sort option.
 *
 * For "artist" returns `album.artist` or the empty string.
 * For "genre" returns the genre string, or the first entry of a genre array, or ""
 * when genre is missing or the array is empty.
 *
 * @param album Album whose sort key to derive.
 * @param option Active sort option.
 * @returns A string suitable for alphabetical ordering.
 */
export function getSortKey(album: Album, option: SortOption): string {
  if (option === "artist") {
    return album.artist || "";
  }
  if (option === "genre") {
    if (typeof album.genre === "string") {
      return album.genre;
    }
    if (Array.isArray(album.genre) && album.genre.length > 0) {
      return album.genre[0] || "";
    }
    return "";
  }
  return "";
}

/**
 * Tracks the active sort mode and exposes sorting behavior that respects pinned album positions.
 *
 * @returns Current sort option plus actions for updating and applying the sort.
 */
export function useAlbumSorting() {
  const [sortOption, setSortOption] = useState<SortOption>("none");

  /**
   * Sorts albums by the active sort option while preserving pinned album positions.
   *
   * Unpinned albums are sorted once using {@link getSortKey}; pinned albums stay at their
   * original indices while sorted unpinned albums fill the remaining slots in order.
   *
   * @param albumsToSort Albums to sort.
   * @param pinnedAlbums Set of pinned album ids that must remain fixed in place.
   * @returns Albums sorted according to the active sort option.
   */
  const sortAlbums = (albumsToSort: Album[], pinnedAlbums: Set<string>) => {
    if (sortOption === "none") return albumsToSort;

    // Collect pinned album positions
    const pinnedIndices = new Map<string, number>();
    albumsToSort.forEach((album, index) => {
      if (pinnedAlbums.has(String(album.id))) {
        pinnedIndices.set(String(album.id), index);
      }
    });

    // Sort unpinned albums using a single shared comparison path
    const unpinnedAlbums = albumsToSort.filter((album) => !pinnedAlbums.has(String(album.id)));
    const sortedUnpinned = [...unpinnedAlbums].sort((a, b) =>
      getSortKey(a, sortOption).localeCompare(getSortKey(b, sortOption))
    );

    // When nothing is pinned the result is just the plain sorted list
    if (pinnedIndices.size === 0) {
      return sortedUnpinned;
    }

    // Build the final array: pinned albums stay, unpinned fill the gaps
    const result = new Array<Album | undefined>(albumsToSort.length);

    pinnedIndices.forEach((index, albumId) => {
      const album = albumsToSort.find((a) => String(a.id) === albumId);
      if (album) {
        result[index] = album;
      }
    });

    let unpinnedIndex = 0;
    for (let i = 0; i < result.length; i++) {
      if (!result[i] && unpinnedIndex < sortedUnpinned.length) {
        result[i] = sortedUnpinned[unpinnedIndex++];
      }
    }

    return result.filter(Boolean) as Album[];
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
