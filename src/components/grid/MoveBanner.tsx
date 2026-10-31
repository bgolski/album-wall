import { Album } from "@/types";

interface MoveBannerProps {
  album: Album;
  /** Replaces the usual instruction, such as when the tapped album is pinned. */
  message: string | null;
  onCancel: () => void;
}

/**
 * Stays at the top of the screen while an album is picked up to swap, saying what to do next.
 */
export function MoveBanner({ album, message, onCancel }: MoveBannerProps) {
  return (
    <div
      role="status"
      data-testid="move-banner"
      className="sticky top-2 z-40 flex items-center justify-between gap-3 rounded-control bg-accent-2 px-4 py-3 text-on-accent-2 shadow-sm"
    >
      <span>{message ?? `Moving ${album.title || "album"}: tap another album to swap.`}</span>
      <button
        type="button"
        className="rounded-control bg-black/80 px-3 py-1 text-ink"
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  );
}
