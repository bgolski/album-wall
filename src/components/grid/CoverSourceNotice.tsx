import { useState, useSyncExternalStore } from "react";
import { ALL_COVER_SOURCES, coverSources, subscribeToCoverSource } from "@/utils/coverSource";

const startWithEverySource = () => ALL_COVER_SOURCES;

/**
 * Tells the visitor when covers are loading straight from their hosts because the image proxy
 * is not responding, and what that means. It can be dismissed for the rest of the visit.
 */
export function CoverSourceNotice() {
  const sources = useSyncExternalStore(subscribeToCoverSource, coverSources, startWithEverySource);
  const [dismissed, setDismissed] = useState(false);
  // Covers the app's image service does not serve go to the proxy next, then load directly.
  if (sources.includes("proxy") || dismissed) return null;

  return (
    <div
      role="status"
      className="mb-4 flex items-center justify-between gap-3 rounded-panel bg-panel px-4 py-3 text-sm text-ink shadow-sm"
    >
      <p>Covers may load slowly or be left out of saved images.</p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted hover:bg-raised hover:text-ink"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
