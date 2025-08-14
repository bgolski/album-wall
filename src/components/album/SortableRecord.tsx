import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Album } from "@/types";
import Image from "next/image";
import { useAlbumImage } from "@/hooks/useAlbumImage";
import { PinButton } from "./PinButton";
import { AlbumLabels } from "./AlbumLabels";
import { AlbumBorder } from "./AlbumBorder";

interface SortableRecordProps {
  album: Album;
  exportMode?: boolean;
  isPinned?: boolean;
  onPinToggle?: (albumId: string) => void;
  disablePinning?: boolean;
}

export function SortableRecord({
  album,
  exportMode = false,
  isPinned = false,
  onPinToggle,
  disablePinning = false,
}: SortableRecordProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: `album-${album.id}`,
    disabled: isPinned,
  });

  const { imageSource, imgRef, handleImageError, handleImageLoad } = useAlbumImage(
    album,
    exportMode
  );

  const style = isPinned
    ? {}
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      };

  const handleAlbumClick = (e: React.MouseEvent) => {
    if (disablePinning || !onPinToggle) return;
    e.stopPropagation();
    onPinToggle(String(album.id));
  };

  return (
    <div
      ref={isPinned ? null : setNodeRef}
      style={style}
      {...(isPinned ? {} : attributes)}
      {...(isPinned ? {} : listeners)}
      className={`aspect-square ${isPinned ? "cursor-pointer" : "cursor-move"} group relative ${
        isPinned ? "z-10" : ""
      }`}
      data-album-id={album.id}
      data-pinned={isPinned ? "true" : "false"}
      onClick={handleAlbumClick}
    >
      <div className="relative w-full h-full">
        <div ref={imgRef} className="w-full h-full relative">
          <Image
            src={imageSource}
            alt={`${album.title || "Album"}`}
            fill
            sizes="(max-width: 768px) 100vw, 200px"
            className="object-cover rounded-lg shadow-lg"
            crossOrigin={exportMode ? "anonymous" : undefined}
            onLoad={handleImageLoad}
            onError={handleImageError}
            style={{ backgroundColor: "#333" }}
            unoptimized
          />
          <AlbumBorder isPinned={isPinned} />
          <PinButton isPinned={isPinned} disabled={disablePinning} />
        </div>
        <AlbumLabels album={album} isPinned={isPinned} />
      </div>
    </div>
  );
}
