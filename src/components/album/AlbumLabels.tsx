import { Album } from "@/types";

interface AlbumLabelsProps {
  album: Album;
  isPinned: boolean;
  showAlbumLabels: boolean | null;
}

/**
 * Displays the album artist and title overlay for non-pinned records. Narrow screens show the
 * artist only, so the label covers less of a small cover.
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
      className={`album-labels absolute bottom-0 left-0 right-0 rounded-b-tile bg-black/70 px-1.5 py-1 text-white sm:p-2 ${visibilityClass}`}
    >
      <p className="text-xs font-bold truncate">{album.artist || "Unknown Artist"}</p>
      <p className="hidden text-xs truncate sm:block">{album.title || "Untitled"}</p>
    </div>
  );
}
