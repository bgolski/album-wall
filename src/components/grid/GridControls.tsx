import type { ReactNode } from "react";
import { SortOption } from "@/hooks/useAlbumSorting";

interface GridControlsProps {
  sortOption: SortOption;
  areAllPinned: boolean;
  showAlbumLabels: boolean;
  onSortChange: (option: SortOption) => void;
  /** A short note about the active sort, such as colors still being read. */
  sortStatus?: string | null | undefined;
  onToggleDimensionsConfig: () => void;
  /** Opens and closes the saved walls. */
  onToggleLayouts?: (() => void) | undefined;
  showLayouts?: boolean | undefined;
  onTogglePinAll: () => void;
  onToggleAlbumLabels: () => void;
  onShuffle: () => void;
  canUndo?: boolean | undefined;
  onUndo?: (() => void) | undefined;
  /** Shares the wall's link (the share sheet on phones, the clipboard elsewhere). */
  onShare?: (() => void) | undefined;
  /** Starts getting the share link ready, as the pointer or focus reaches Share. */
  onPrepareShare?: (() => void) | undefined;
  /** Opens and closes the export panel. */
  onToggleExport: () => void;
  showExport: boolean;
  showDimensionsConfig: boolean;
  /** One-tap choices for the open Arrange mode, drawn under the controls. */
  arrangeChoices?: ReactNode;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "none", label: "By hand" },
  { value: "artist", label: "Artist" },
  { value: "genre", label: "Genre" },
  { value: "year", label: "Year" },
  { value: "color", label: "Color" },
];

const buttonClass =
  "flex items-center justify-center gap-1.5 whitespace-nowrap rounded-control px-1.5 py-2 text-[13px] font-medium text-ink transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:text-sm md:py-1.5 [&>svg]:shrink-0";
const plainClass = `${buttonClass} bg-raised hover:bg-line`;

/**
 * A group of controls with a small heading.
 */
function ControlGroup({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div role="group" aria-labelledby={id} className="flex min-w-0 flex-col gap-1.5">
      <h3 id={id} className="text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </h3>
      {children}
    </div>
  );
}

/**
 * A box that is ticked when a switch is on, so its state shows without relying on color.
 */
function SwitchMark({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${
        on ? "border-accent bg-accent text-on-accent" : "border-muted"
      }`}
    >
      {on && (
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

/**
 * Renders the wall's controls in three groups: how the wall is arranged, the wall itself, and
 * saving and sharing it. Switches keep their names and show their state with a tick; panel
 * buttons show whether their panel is open.
 */
export function GridControls({
  sortOption,
  areAllPinned,
  showAlbumLabels,
  onSortChange,
  sortStatus = null,
  onToggleDimensionsConfig,
  onToggleLayouts,
  showLayouts = false,
  onTogglePinAll,
  onToggleAlbumLabels,
  onShuffle,
  canUndo = false,
  onUndo,
  onShare,
  onPrepareShare,
  onToggleExport,
  showExport,
  showDimensionsConfig,
  arrangeChoices,
}: GridControlsProps) {
  const panelButtonClass = (open: boolean) =>
    `${buttonClass} ${open ? "bg-line ring-2 ring-inset ring-accent" : "bg-raised hover:bg-line"}`;

  return (
    <div className="rounded-panel bg-panel p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-6">
        <ControlGroup id="arrange-heading" label="Arrange">
          <div className="flex gap-1.5 sm:gap-2">
            <div className="grid flex-1 grid-cols-3 gap-0.5 sm:grid-cols-5 rounded-control bg-raised p-0.5 lg:flex lg:flex-none">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => onSortChange(option.value)}
                  className={`whitespace-nowrap rounded-[8px] px-1 py-1.5 text-[13px] font-medium transition-colors sm:px-2 sm:text-sm md:py-1 lg:px-3 ${
                    sortOption === option.value
                      ? "bg-accent text-on-accent shadow-sm"
                      : "text-ink hover:bg-line"
                  }`}
                  aria-pressed={sortOption === option.value}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              onClick={onShuffle}
              className={plainClass}
              disabled={areAllPinned}
              aria-label="Shuffle"
              title={
                areAllPinned ? "Unpin some albums to shuffle" : "Randomly rearrange unpinned albums"
              }
              type="button"
            >
              <svg
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm0.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
              </svg>
              <span className="hidden sm:inline">Shuffle</span>
            </button>
          </div>
        </ControlGroup>

        <ControlGroup id="wall-heading" label="Wall">
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2 lg:flex">
            <button
              onClick={onToggleDimensionsConfig}
              className={panelButtonClass(showDimensionsConfig)}
              aria-expanded={showDimensionsConfig}
              type="button"
            >
              Wall size
            </button>
            <button
              onClick={onToggleAlbumLabels}
              className={plainClass}
              aria-pressed={showAlbumLabels}
              type="button"
            >
              <SwitchMark on={showAlbumLabels} />
              Labels
            </button>
            <button
              onClick={onTogglePinAll}
              className={plainClass}
              aria-pressed={areAllPinned}
              title="Pin every album on the wall, so sorting and shuffling leave them in place"
              type="button"
            >
              <SwitchMark on={areAllPinned} />
              Pin all
            </button>
            <button
              onClick={onUndo}
              className={plainClass}
              disabled={!canUndo}
              title="Undo the last change (Ctrl+Z)"
              aria-keyshortcuts="Control+Z Meta+Z"
              type="button"
            >
              <svg
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path d="M12.5 8c-2.65 0-5.05 1-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" />
              </svg>
              Undo
            </button>
          </div>
        </ControlGroup>

        <ControlGroup id="save-share-heading" label="Save & share">
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 lg:flex">
            {onToggleLayouts && (
              <button
                onClick={onToggleLayouts}
                className={panelButtonClass(showLayouts)}
                aria-expanded={showLayouts}
                type="button"
              >
                Saved walls
              </button>
            )}
            {onShare && (
              <button
                onClick={onShare}
                onPointerEnter={onPrepareShare}
                onPointerDown={onPrepareShare}
                onFocus={onPrepareShare}
                className={`${buttonClass} bg-accent text-on-accent hover:bg-accent-hover`}
                type="button"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
                </svg>
                Share link
              </button>
            )}
            <button
              onClick={onToggleExport}
              className={panelButtonClass(showExport)}
              aria-expanded={showExport}
              type="button"
            >
              Export
            </button>
          </div>
        </ControlGroup>
      </div>
      {arrangeChoices}
      {sortStatus && (
        <p role="status" className="mt-3 text-sm text-muted">
          {sortStatus}
        </p>
      )}
    </div>
  );
}
