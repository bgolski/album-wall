import type { RefObject } from "react";
import { SortOption } from "@/hooks/useAlbumSorting";

interface GridControlsProps {
  sortOption: SortOption;
  areAllPinned: boolean;
  showAlbumLabels: boolean;
  onSortChange: (option: SortOption) => void;
  onToggleDimensionsConfig: () => void;
  onTogglePinAll: () => void;
  onToggleAlbumLabels: () => void;
  onShuffle: () => void;
  canUndo?: boolean | undefined;
  onUndo?: (() => void) | undefined;
  onToggleExportDropdown: () => void;
  showDimensionsConfig: boolean;
  exportOpen: boolean;
  exportMenuId: string;
  exportButtonRef: RefObject<HTMLButtonElement | null>;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "none", label: "Custom Order" },
  { value: "artist", label: "Sort by Artist" },
  { value: "genre", label: "Sort by Genre" },
];

/**
 * Renders the grid control bar for sorting, pinning, shuffling, exporting, and grid settings.
 */
export function GridControls({
  sortOption,
  areAllPinned,
  showAlbumLabels,
  onSortChange,
  onToggleDimensionsConfig,
  onTogglePinAll,
  onToggleAlbumLabels,
  onShuffle,
  canUndo = false,
  onUndo,
  onToggleExportDropdown,
  showDimensionsConfig,
  exportOpen,
  exportMenuId,
  exportButtonRef,
}: GridControlsProps) {
  const actionButtonClass =
    "flex-1 rounded-control px-3 py-2 text-sm font-medium transition-colors min-[360px]:basis-[calc(50%-0.25rem)] md:flex-none md:basis-auto md:px-3 md:py-1.5";

  return (
    <div className="bg-panel p-4 rounded-panel shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-3 md:flex-1">
          <h2 id="sort-records-heading" className="text-base font-semibold text-ink md:text-lg">
            Sort Records
          </h2>
          <div
            role="group"
            aria-labelledby="sort-records-heading"
            className="grid grid-cols-1 gap-2 sm:grid-cols-3 md:flex md:flex-wrap md:gap-4"
          >
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => onSortChange(option.value)}
                className={`rounded-control px-3 py-2 text-sm font-medium transition-colors md:px-3 md:py-1.5 ${
                  sortOption === option.value
                    ? "bg-accent text-on-accent"
                    : "bg-raised text-ink hover:bg-line"
                }`}
                aria-pressed={sortOption === option.value}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 md:items-center md:justify-end md:gap-3">
          <button
            onClick={onToggleDimensionsConfig}
            className={`${actionButtonClass} bg-raised text-ink hover:bg-line`}
            aria-expanded={showDimensionsConfig}
            type="button"
          >
            {showDimensionsConfig ? "Hide Grid Config" : "Configure Grid"}
          </button>

          <button
            onClick={onTogglePinAll}
            className={`${actionButtonClass} flex items-center justify-center ${
              areAllPinned
                ? "bg-accent text-on-accent hover:bg-accent-hover"
                : "bg-raised text-ink hover:bg-line"
            }`}
            type="button"
          >
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-4 h-4 mr-1"
            >
              {areAllPinned ? (
                <path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z" />
              ) : (
                <path d="M17 3H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v6h2.03v-6H19v-2c-1.66 0-3-1.34-3-3V5h1c.55 0 1-.45 1-1s-.45-1-1-1zm-6 8.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
              )}
            </svg>
            {areAllPinned ? "Unpin All" : "Pin All"}
          </button>

          <button
            onClick={onToggleAlbumLabels}
            className={`${actionButtonClass} ${
              showAlbumLabels
                ? "bg-accent text-on-accent hover:bg-accent-hover"
                : "bg-raised text-ink hover:bg-line"
            }`}
            type="button"
          >
            {showAlbumLabels ? "Hide Labels" : "Show Labels"}
          </button>

          <button
            onClick={onShuffle}
            className={`${actionButtonClass} flex items-center justify-center bg-accent-2 text-on-accent-2 hover:bg-accent-2-hover disabled:cursor-not-allowed disabled:opacity-50`}
            disabled={areAllPinned}
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
              className="w-4 h-4 mr-1"
            >
              <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm0.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
            </svg>
            Shuffle
          </button>

          <button
            onClick={onUndo}
            className={`${actionButtonClass} flex items-center justify-center bg-raised text-ink hover:bg-line disabled:cursor-not-allowed disabled:opacity-50`}
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
              className="w-4 h-4 mr-1"
            >
              <path d="M12.5 8c-2.65 0-5.05 1-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" />
            </svg>
            Undo
          </button>

          <div className="relative flex-1 min-[360px]:basis-[calc(50%-0.25rem)] md:flex-none md:basis-auto">
            <button
              ref={exportButtonRef}
              aria-haspopup="menu"
              aria-expanded={exportOpen}
              aria-controls={exportOpen ? exportMenuId : undefined}
              onClick={onToggleExportDropdown}
              className={`${actionButtonClass} w-full flex items-center justify-center bg-accent text-on-accent hover:bg-accent-hover md:w-auto`}
              type="button"
            >
              <span className="mr-1">Export</span>
              <svg
                aria-hidden="true"
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
