import { useEffect, useRef } from "react";
import { Album } from "@/types";

interface AlbumActionSheetProps {
  album: Album;
  isPinned: boolean;
  canPin: boolean;
  onClose: () => void;
  onTogglePin: () => void;
  onMove: () => void;
}

/**
 * Shows an album's details with the actions that are awkward as touch gestures: pin, unpin and
 * move (pick the album up, then tap another one to swap places). Closes on Escape or a tap
 * outside the panel.
 */
export function AlbumActionSheet({
  album,
  isPinned,
  canPin,
  onClose,
  onTogglePin,
  onMove,
}: AlbumActionSheetProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const title = album.title || "Untitled album";
  const details = [album.year, album.genre?.join(", ")].filter(Boolean).join(" · ");
  const actionClass =
    "w-full rounded-control bg-raised px-4 py-3 text-left text-ink hover:bg-line disabled:opacity-50";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
      data-testid="album-sheet-backdrop"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${title} actions`}
        className="w-full max-w-md rounded-t-panel bg-panel p-4 shadow-xl sm:rounded-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4">
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          <p className="text-ink">{album.artist}</p>
          {details && <p className="text-sm text-muted">{details}</p>}
        </div>
        <div className="flex flex-col gap-2">
          {canPin && (
            <button type="button" className={actionClass} onClick={onTogglePin}>
              {isPinned ? "Unpin" : "Pin in place"}
            </button>
          )}
          <button type="button" className={actionClass} onClick={onMove} disabled={isPinned}>
            {isPinned ? "Move (unpin first)" : "Move: then tap another album to swap"}
          </button>
          {album.discogsUrl && (
            <a
              href={album.discogsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={actionClass}
            >
              Open in Discogs
            </a>
          )}
          <button type="button" className={actionClass} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
