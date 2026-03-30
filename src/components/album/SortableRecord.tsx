import { useEffect, useRef, useState } from "react";
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
  showAlbumLabels: boolean | null;
}

/**
 * Renders a draggable album tile with optional pinning controls and export-safe image behavior.
 */
export function SortableRecord({
  album,
  exportMode = false,
  isPinned = false,
  onPinToggle,
  disablePinning = false,
  showAlbumLabels,
}: SortableRecordProps) {
  const [showMobileDiscogsAction, setShowMobileDiscogsAction] = useState(false);
  const recordRef = useRef<HTMLDivElement | null>(null);
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

  const canOpenDiscogs = Boolean(album.discogsUrl);

  useEffect(() => {
    if (!showMobileDiscogsAction) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!recordRef.current?.contains(event.target as Node)) {
        setShowMobileDiscogsAction(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [showMobileDiscogsAction]);

  /**
   * Toggles pinning for the clicked album when pinning is enabled on this record tile.
   *
   * @param e Click event from the album tile.
   */
  const handleAlbumClick = (e: React.MouseEvent) => {
    if (disablePinning || !onPinToggle) return;
    e.stopPropagation();
    onPinToggle(String(album.id));
  };

  /**
   * Toggles the mobile Discogs action chip from the dedicated album hotspot.
   *
   * @param e Click event from the Discogs action trigger.
   */
  const handleDiscogsTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMobileDiscogsAction((current) => !current);
  };

  /**
   * Closes the mobile Discogs action chip after the release link is activated.
   */
  const handleDiscogsLinkClick = () => {
    setShowMobileDiscogsAction(false);
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
          {canOpenDiscogs && (
            <>
              <a
                href={album.discogsUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="absolute left-2 top-2 z-10 hidden h-6 items-center gap-1 rounded-full bg-black/70 px-2 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 md:flex"
                aria-label={`Open ${album.title || "album"} in Discogs`}
                title="Open in Discogs"
              >
                <svg
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

              <div className="absolute left-2 top-2 z-10 md:hidden">
                <button
                  type="button"
                  onClick={handleDiscogsTriggerClick}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white shadow-sm transition-colors hover:bg-black/75"
                  aria-label={`Show Discogs link for ${album.title || "album"}`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-4 w-4"
                  >
                    <path d="M13.5 3a1 1 0 0 0 0 2h4.59l-8.8 8.79a1 1 0 1 0 1.42 1.42l8.79-8.8V11a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1h-7z" />
                    <path d="M5 5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4a1 1 0 1 0-2 0v4H5V7h4a1 1 0 1 0 0-2H5z" />
                  </svg>
                </button>
              </div>

              {showMobileDiscogsAction && (
                <div className="absolute inset-x-2 bottom-2 z-10 flex justify-center md:hidden">
                  <a
                    href={album.discogsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDiscogsLinkClick();
                    }}
                    className="flex max-w-full items-center rounded-2xl bg-black/80 px-3 py-2 text-xs font-medium text-white shadow-lg"
                  >
                    <span className="truncate">Open in Discogs</span>
                  </a>
                </div>
              )}
            </>
          )}
        </div>
        <AlbumLabels album={album} isPinned={isPinned} showAlbumLabels={showAlbumLabels} />
      </div>
    </div>
  );
}
