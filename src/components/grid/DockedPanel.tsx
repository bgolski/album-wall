import type { ReactNode } from "react";

interface DockedPanelProps {
  /** Names the panel for the close button, such as "Wall size". */
  label: string;
  onClose: () => void;
  /** Hidden while no panel is open; the panels stay mounted so they keep what was entered. */
  hidden?: boolean;
  children: ReactNode;
}

/**
 * Holds the open wall panel: a column beside the wall on wide screens, so changes show on the
 * wall straight away, and a sheet along the bottom of the screen on narrow ones. Its contents lay
 * themselves out by the panel's width, not the screen's.
 */
export function DockedPanel({ label, onClose, hidden = false, children }: DockedPanelProps) {
  return (
    <aside
      aria-label={label}
      data-testid="docked-panel"
      hidden={hidden}
      className="@container fixed inset-x-0 bottom-0 z-40 max-h-[55vh] overflow-y-auto rounded-t-panel border-t border-line bg-panel p-4 shadow-2xl lg:sticky lg:top-4 lg:bottom-auto lg:z-auto lg:max-h-[calc(100vh-2rem)] lg:rounded-panel lg:border-0 lg:shadow-sm"
    >
      <button
        type="button"
        aria-label={`Close ${label}`}
        onClick={onClose}
        className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-raised hover:text-ink"
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
      {children}
    </aside>
  );
}
