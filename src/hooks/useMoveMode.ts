import { useState } from "react";
import type { Album } from "@/types";
import { swapAlbums } from "@/wall/dragAndDropHelpers";
import { dragId } from "@/wall/albumKey";

/**
 * Taps on covers: a tap opens the album's details, and "Move" in the details picks the album up
 * so the next tap on another cover swaps the two (pinned covers cannot be swapped).
 *
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

    const next = swapAlbums(
      [...displayedAlbums, ...poolItems],
      dragId(movingAlbum),
      dragId(album),
      pinnedAlbums
    );
    if (next === null) {
      setMoveMessage("That one is pinned");
      return;
    }

    onAlbumsReorder(next);
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
