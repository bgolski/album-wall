import { Album } from "@/types";
import { albumKey } from "@/wall/albumKey";

/**
 * Provides shuffle behavior that preserves pinned album positions in the displayed grid.
 *
 * @returns A shuffle action for redistributing unpinned albums between the grid and pool.
 */
export function useAlbumShuffle() {
  /**
   * Shuffles all unpinned albums while keeping pinned albums fixed in their current grid slots.
   *
   * @returns New grid and pool arrays after shuffling unpinned albums.
   */
  const shuffleUnpinnedAlbums = (
    displayedAlbums: Album[],
    poolItems: Album[],
    pinnedAlbums: Set<string>
  ) => {
    // Separate pinned and unpinned albums from the display
    const pinnedAlbumsArray: Album[] = [];
    const unpinnedAlbumsArray: Album[] = [];
    const pinnedIndicesMap = new Map<string, number>();

    // Sort displayed albums into pinned and unpinned arrays
    displayedAlbums.forEach((album, index) => {
      if (pinnedAlbums.has(albumKey(album))) {
        pinnedAlbumsArray.push(album);
        pinnedIndicesMap.set(albumKey(album), index);
      } else {
        unpinnedAlbumsArray.push(album);
      }
    });

    // Determine how many slots are available for unpinned albums
    const availableSlots = displayedAlbums.length - pinnedAlbumsArray.length;

    // Combine unpinned albums from display with pool items for shuffling
    const allUnpinnedAlbums = [...unpinnedAlbumsArray, ...poolItems];

    // Shuffle all unpinned albums
    const shuffledUnpinned = [...allUnpinnedAlbums].sort(() => Math.random() - 0.5);

    // Take only what we need for the display
    const unpinnedForDisplay = shuffledUnpinned.slice(0, availableSlots);
    const newPoolItems = shuffledUnpinned.slice(availableSlots);

    // Create a new array with the same length as displayedAlbums
    const newDisplayedAlbums: Album[] = new Array(displayedAlbums.length);

    // Place pinned albums back at their original positions
    pinnedAlbumsArray.forEach((pinnedAlbum) => {
      const albumId = albumKey(pinnedAlbum);
      const originalIndex = pinnedIndicesMap.get(albumId);
      if (originalIndex !== undefined) {
        newDisplayedAlbums[originalIndex] = pinnedAlbum;
      }
    });

    // Fill empty spots with shuffled unpinned albums
    let unpinnedIndex = 0;
    for (let i = 0; i < newDisplayedAlbums.length; i++) {
      const nextAlbum = newDisplayedAlbums[i] ? undefined : unpinnedForDisplay[unpinnedIndex];
      if (nextAlbum) {
        newDisplayedAlbums[i] = nextAlbum;
        unpinnedIndex++;
      }
    }

    return {
      newDisplayedAlbums,
      newPoolItems,
    };
  };

  return { shuffleUnpinnedAlbums };
}
