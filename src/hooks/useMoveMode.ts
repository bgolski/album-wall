import { useState } from "react";
import type { Album } from "@/types";
import { swapAlbums } from "@/utils/dragAndDropHelpers";

/**
 * Taps on covers: a tap opens the album's details, and "Move" in the details picks the album up
 * so the next tap on another cover swaps the two (pinned covers cannot be swapped).
 *
 * @param input.displayedAlbums Albums on the wall.
 * @param input.poolItems Albums in the pool.
 * @param input.pinnedAlbums Ids of pinned albums.
 * @param input.onAlbumsReorder Applies a new order.
 * @returns The album whose details are open, the album being moved and its message, and actions.
 */
export function useMoveMode(input: {
  displayedAlbums: Album[];
  poolItems: Album[];
  pinnedAlbums: Set<string>;
  onAlbumsReorder: (albums: Album[]) => void;
}) {
  const { displayedAlbums, poolItems, pinnedAlbums, onAlbumsReorder } = input;
  const [sheetAlbum, setSheetAlbum] = useState<Album | null>(null);
  const [movingAlbum, setMovingAlbum] = useState<Album | null>(null);
  const [moveMessage, setMoveMessage] = useState<string | null>(null);

  const cancelMove = () => {
    setMovingAlbum(null);
    setMoveMessage(null);
  };

  const startMove = (album: Album) => {
    setMovingAlbum(album);
    setMoveMessage(null);
    setSheetAlbum(null);
  };

  /**
   * Handles a tap on a tile: finishes a pending move by swapping with the tapped album,
   * otherwise opens the tapped album's details.
   *
   * @param album Album that was tapped.
   */
  const selectAlbum = (album: Album) => {
    if (!movingAlbum) {
      setSheetAlbum(album);
      return;
    }
    if (album.id === movingAlbum.id) {
      cancelMove();
      return;
    }

    const { newDisplayedAlbums, newPoolItems } = swapAlbums(
      displayedAlbums,
      poolItems,
      `album-${movingAlbum.id}`,
      `album-${album.id}`,
      pinnedAlbums
    );
    if (newDisplayedAlbums === displayedAlbums && newPoolItems === poolItems) {
      setMoveMessage("That one is pinned");
      return;
    }

    onAlbumsReorder([...newDisplayedAlbums, ...newPoolItems]);
    cancelMove();
  };

  return {
    sheetAlbum,
    closeSheet: () => setSheetAlbum(null),
    movingAlbum,
    moveMessage,
    startMove,
    cancelMove,
    selectAlbum,
  };
}
