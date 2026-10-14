import type { Album } from "@/types";

/**
 * Changing the wall's size: albums that a smaller wall pushes back into the pool are unpinned
 * first, so no pin is left pointing at the pool.
 *
 * @param input.displayedAlbums Albums on the wall now.
 * @param input.removePinsForAlbums Unpins albums by id.
 * @param input.setSize Sets rows and columns.
 * @param input.resetSize Restores the default size.
 * @param input.defaultSize Albums the default wall holds.
 * @returns `changeSize` and `resetSize`.
 */
export function useWallResize(input: {
  displayedAlbums: Album[];
  removePinsForAlbums: (albumIds: string[]) => void;
  setSize: (rows: number, columns: number) => void;
  resetSize: () => void;
  defaultSize: number;
}) {
  const { displayedAlbums, removePinsForAlbums, setSize, resetSize, defaultSize } = input;

  const unpinAlbumsBeyond = (newSize: number) => {
    if (newSize < displayedAlbums.length) {
      removePinsForAlbums(displayedAlbums.slice(newSize).map((album) => String(album.id)));
    }
  };

  return {
    changeSize: (rows: number, columns: number) => {
      if (rows < 1 || columns < 1) return;
      unpinAlbumsBeyond(rows * columns);
      setSize(rows, columns);
    },
    resetSize: () => {
      unpinAlbumsBeyond(defaultSize);
      resetSize();
    },
  };
}
