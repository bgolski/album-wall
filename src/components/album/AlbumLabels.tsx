import { Album } from "@/types";

interface AlbumLabelsProps {
  album: Album;
  isPinned: boolean;
}

export function AlbumLabels({ album, isPinned }: AlbumLabelsProps) {
  return (
    <div
      className={`absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white p-2 rounded-b-lg album-labels ${
        isPinned ? "hidden" : ""
      }`}
    >
      <p className="text-xs font-bold truncate">{album.artist || "Unknown Artist"}</p>
      <p className="text-xs truncate">{album.title || "Untitled"}</p>
    </div>
  );
}
