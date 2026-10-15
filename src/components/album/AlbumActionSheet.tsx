import { useEffect, useRef } from "react";
import { Album } from "@/types";
import type { CoverProfile } from "@/utils/coverProfile";
import { oklabToHex } from "@/utils/gradientTargets";
import { namedMainColors } from "@/utils/colorName";
import { formatDay } from "@/utils/hangHistory";
import { useAlbumImage } from "@/hooks/useAlbumImage";
import { TILE_COVER_SIZE } from "@/utils/imageProxy";

interface AlbumActionSheetProps {
  album: Album;
  isPinned: boolean;
  canPin: boolean;
  onClose: () => void;
  onTogglePin: () => void;
  onMove: () => void;
  /** The colors read from the cover, shown while Sort by Color is open; `null` if none could be read. */
  colorProfile?: CoverProfile | null;
  /** The day it was last on a wall the user hung, `null` if never; omitted when there is no history. */
  lastHungOn?: string | null;
  /** Other pressings of this album set aside by "show each album once". */
  otherPressings?: Album[];
  /** Shows another pressing instead of this one. */
  onShowPressing?: (album: Album) => void;
  /** Starts a gradient wall from one of the cover's colors (a hex code). */
  onStartFromColor?: (hex: string) => void;
}

/**
 * Shows an album's cover and details with the actions that are awkward as touch gestures: pin,
 * unpin and swap (pick the album up, then tap another one to swap places). Closes on Escape, the
 * close button or a tap outside the panel.
 */
export function AlbumActionSheet({
  album,
  isPinned,
  canPin,
  onClose,
  onTogglePin,
  onMove,
  colorProfile,
  lastHungOn,
  otherPressings = [],
  onShowPressing,
  onStartFromColor,
}: AlbumActionSheetProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const { imageSource, coverMissing, handleImageError } = useAlbumImage(album, TILE_COVER_SIZE);

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const title = album.title || "Untitled album";
  const release = [album.year, album.label].filter(Boolean).join(" · ");
  // Genres first, then the finer styles Discogs files the record under.
  const kinds = [album.genre?.join(", "), album.styles?.join(", ")].filter(Boolean).join(" · ");
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
          <div className="flex items-start gap-3">
            {!coverMissing && (
              // eslint-disable-next-line @next/next/no-img-element -- a small cover from the same source as the tile
              <img
                src={imageSource}
                alt=""
                width={80}
                height={80}
                className="h-20 w-20 shrink-0 rounded-tile bg-raised object-cover shadow-sm"
                onError={handleImageError}
              />
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-ink">{title}</h2>
              <p className="text-ink">{album.artist}</p>
              {release && <p className="text-sm text-muted">{release}</p>}
              {kinds && <p className="text-sm text-muted">{kinds}</p>}
            </div>
            <button
              type="button"
              aria-label="Close"
              className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-raised hover:text-ink"
              onClick={onClose}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          {lastHungOn !== undefined && (
            <p className="text-sm text-muted">
              {lastHungOn ? `Last on the wall ${formatDay(lastHungOn)}` : "Not on your wall yet"}
            </p>
          )}
          {colorProfile !== undefined && (
            <CoverColors profile={colorProfile} onStartFromColor={onStartFromColor} />
          )}
          {otherPressings.length > 0 && onShowPressing && (
            <div className="mt-3">
              <p className="mb-1 text-sm text-muted">Other pressings in your collection</p>
              <ul className="flex flex-col gap-1">
                {otherPressings.map((pressing) => (
                  <li
                    key={pressing.id}
                    className="flex items-center justify-between gap-2 text-sm text-ink"
                  >
                    <span>
                      {pressing.title}
                      {pressing.year ? ` (${pressing.year})` : ""}
                    </span>
                    <button
                      type="button"
                      className="rounded-control bg-raised px-3 py-1 text-sm text-ink hover:bg-line"
                      onClick={() => onShowPressing(pressing)}
                    >
                      Show this one instead
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {canPin && (
            <button type="button" className={actionClass} onClick={onTogglePin}>
              {isPinned ? "Unpin" : "Pin in place"}
            </button>
          )}
          <button type="button" className={actionClass} onClick={onMove} disabled={isPinned}>
            {isPinned ? "Unpin to swap it" : "Swap with another album"}
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
        </div>
      </div>
    </div>
  );
}

/**
 * The main colors Sort by Color read from a cover, as named swatches with their share, so it is
 * clear why the cover lands where it does on a gradient wall.
 */
function CoverColors({
  profile,
  onStartFromColor,
}: {
  profile: CoverProfile | null;
  onStartFromColor?: ((hex: string) => void) | undefined;
}) {
  if (!profile) {
    return (
      <p className="mt-2 text-sm text-muted">
        Sort by Color could not read the colors of this cover.
      </p>
    );
  }
  // Shades with the same name are one color to a person: shown once, with their shares added.
  const shown = namedMainColors(profile);
  return (
    <div className="mt-3">
      <p className="mb-1 text-sm text-muted">Colors Sort by Color sees</p>
      <ul className="flex flex-wrap gap-3">
        {shown.map((entry) => (
          <li key={entry.name} className="flex items-center gap-2 text-sm text-ink">
            <span
              aria-hidden="true"
              className="inline-block h-5 w-5 rounded-full border border-line"
              style={{ backgroundColor: oklabToHex(entry.color) }}
            />
            {entry.name} <span className="text-muted">{Math.round(entry.share * 100)}%</span>
            {onStartFromColor && (
              <button
                type="button"
                className="rounded-control bg-raised px-2 py-0.5 text-xs text-ink hover:bg-line"
                aria-label={`Start a wall from this ${entry.name}`}
                onClick={() => onStartFromColor(oklabToHex(entry.color))}
              >
                Start a wall from this color
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
