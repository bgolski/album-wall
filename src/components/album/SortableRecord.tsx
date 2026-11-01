import { useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Album } from "@/types";
import Image from "next/image";
import { useAlbumImage } from "@/hooks/useAlbumImage";
import { useNearViewport } from "@/hooks/useNearViewport";
import { dragId, albumKey } from "@/utils/albumKey";
import { PinButton } from "./PinButton";
import { AlbumLabels } from "./AlbumLabels";
import { AlbumBorder } from "./AlbumBorder";

interface SortableRecordProps {
  album: Album;
  imageSize?: number;
  isPinned?: boolean;
  onPinToggle?: (albumId: string) => void;
  onSelect?: (album: Album) => void;
  isMoveSource?: boolean;
  disablePinning?: boolean;
  showAlbumLabels: boolean | null;
}

/**
 * Renders a draggable album tile with optional pinning controls.
 */
export function SortableRecord({
  album,
  imageSize,
  isPinned = false,
  onPinToggle,
  onSelect,
  isMoveSource = false,
  disablePinning = false,
  showAlbumLabels,
}: SortableRecordProps) {
  const recordRef = useRef<HTMLDivElement | null>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: dragId(album),
    disabled: isPinned,
  });

  const { imageSource, coverMissing, imgRef, handleImageError, handleImageLoad } = useAlbumImage(
    album,
    imageSize
  );

  // Covers load as their tile nears the screen, not all at once for a large collection.
  const showImage = useNearViewport(imgRef);

  const style = isPinned
    ? {}
    : {
        transform: CSS.Transform.toString(transform),
        transition,
        // The drag overlay shows the moving cover; the original stays as a faded placeholder.
        opacity: isDragging ? 0.4 : undefined,
      };

  const canOpenDiscogs = Boolean(album.discogsUrl);

  /**
   * Reports the tapped album so the grid can open its actions or finish a move.
   */
  const handleAlbumClick = (e: React.MouseEvent) => {
    if (!onSelect) return;
    e.stopPropagation();
    onSelect(album);
  };

  const handleRecordRef = (node: HTMLDivElement | null) => {
    recordRef.current = node;

    if (!isPinned) {
      setNodeRef(node);
    }
  };

  return (
    <div
      ref={handleRecordRef}
      style={style}
      {...(isPinned ? { role: "group" } : { ...attributes, role: "group" })}
      aria-label={`${album.title || "Album"} by ${album.artist}${isPinned ? ", pinned" : ""}`}
      {...(isPinned ? {} : listeners)}
      className={`aspect-square cursor-pointer select-none [-webkit-touch-callout:none] group relative ${
        isPinned ? "z-10" : ""
      } ${isMoveSource ? "ring-4 ring-accent-2 rounded-tile" : ""}`}
      data-album-id={album.id}
      data-pinned={isPinned ? "true" : "false"}
      data-cover-missing={coverMissing ? "true" : undefined}
      onClick={handleAlbumClick}
    >
      <div className="relative w-full h-full">
        <div
          ref={imgRef}
          className="w-full h-full relative rounded-tile"
          style={showImage ? undefined : { backgroundColor: "#333" }}
        >
          {showImage && (
            <Image
              src={imageSource}
              alt={`${album.title || "Album"}`}
              fill
              sizes="(max-width: 768px) 100vw, 200px"
              className="object-cover rounded-tile shadow-lg"
              onLoad={handleImageLoad}
              onError={handleImageError}
              style={{ backgroundColor: "#333" }}
              unoptimized
            />
          )}
          <AlbumBorder isPinned={isPinned} />
          <PinButton
            isPinned={isPinned}
            title={album.title || "album"}
            disabled={disablePinning || !onPinToggle}
            onToggle={() => onPinToggle?.(albumKey(album))}
          />
          {canOpenDiscogs && (
            <>
              <a
                href={album.discogsUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="absolute left-2 top-2 z-10 hidden h-6 items-center gap-1 rounded-full bg-black/70 px-2 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 md:flex pointer-coarse:hidden!"
                aria-label={`Open ${album.title || "album"} in Discogs`}
                title="Open in Discogs"
              >
                <svg
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-3.5 w-3.5"
                >
                  <path d="M13.5 3a1 1 0 0 0 0 2h4.59l-8.8 8.79a1 1 0 1 0 1.42 1.42l8.79-8.8V11a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1h-7z" />
                  <path d="M5 5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4a1 1 0 1 0-2 0v4H5V7h4a1 1 0 1 0 0-2H5z" />
                </svg>
                <span>Discogs</span>
              </a>
            </>
          )}
        </div>
        <AlbumLabels album={album} isPinned={isPinned} showAlbumLabels={showAlbumLabels} />
      </div>
    </div>
  );
}
