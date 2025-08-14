import { useState } from "react";
import { Album } from "@/types";

export function useAlbumPinning() {
  const [pinnedAlbums, setPinnedAlbums] = useState<Set<string>>(new Set());

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

  const removePinsForAlbums = (albumIds: string[]) => {
    setPinnedAlbums((prevPinned) => {
      const newPinned = new Set(prevPinned);
      albumIds.forEach((id) => newPinned.delete(id));
      return newPinned;
    });
  };

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
    areAllPinned,
  };
}
