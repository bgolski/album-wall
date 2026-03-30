import { Album } from "@/types";

interface AlbumLabelsProps {
  album: Album;
  isPinned: boolean;
  showAlbumLabels: boolean | null;
}

/**
 * Displays the album artist and title overlay for non-pinned records.
 */
export function AlbumLabels({ album, isPinned, showAlbumLabels }: AlbumLabelsProps) {
  const visibilityClass = isPinned
    ? "hidden"
    : showAlbumLabels === null
      ? "hidden md:block"
      : showAlbumLabels
        ? "block"
        : "hidden";

  return (
    <div
      className={`album-labels absolute bottom-0 left-0 right-0 rounded-b-lg bg-black bg-opacity-70 p-2 text-white ${visibilityClass}`}
    >
      <p className="text-xs font-bold truncate">{album.artist || "Unknown Artist"}</p>
      <p className="text-xs truncate">{album.title || "Untitled"}</p>
    </div>
  );
}
