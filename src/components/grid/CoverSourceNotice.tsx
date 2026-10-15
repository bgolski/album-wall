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
      className="mb-4 flex items-start justify-between gap-3 rounded-panel bg-panel px-4 py-3 text-sm text-ink shadow-sm"
    >
      <p>
        Cover images are loading directly because the image service isn&apos;t responding. Some
        covers may load slowly or be left out of saved images.
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-control bg-raised px-3 py-1 text-ink hover:bg-line"
      >
        Dismiss
      </button>
    </div>
  );
}
