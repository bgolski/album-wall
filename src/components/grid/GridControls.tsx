import { SortOption } from "@/hooks/useAlbumSorting";

interface GridControlsProps {
  sortOption: SortOption;
  areAllPinned: boolean;
  onSortChange: (option: SortOption) => void;
  onToggleDimensionsConfig: () => void;
  onTogglePinAll: () => void;
  onShuffle: () => void;
  onToggleExportDropdown: () => void;
  showDimensionsConfig: boolean;
}

export function GridControls({
  sortOption,
  areAllPinned,
  onSortChange,
  onToggleDimensionsConfig,
  onTogglePinAll,
  onShuffle,
  onToggleExportDropdown,
  showDimensionsConfig,
}: GridControlsProps) {
  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <h2 className="text-lg font-semibold text-white mr-4">Sort Records</h2>
          <div className="flex gap-4">
            <button
              onClick={() => onSortChange("none")}
              className={`px-3 py-1.5 rounded ${
                sortOption === "none"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-600 text-white hover:bg-gray-500"
              }`}
            >
              Custom Order
            </button>
            <button
              onClick={() => onSortChange("artist")}
              className={`px-3 py-1.5 rounded ${
                sortOption === "artist"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-600 text-white hover:bg-gray-500"
              }`}
            >
              Sort by Artist
            </button>
            <button
              onClick={() => onSortChange("genre")}
              className={`px-3 py-1.5 rounded ${
                sortOption === "genre"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-600 text-white hover:bg-gray-500"
              }`}
            >
              Sort by Genre
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onToggleDimensionsConfig}
            className="px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-500"
          >
            {showDimensionsConfig ? "Hide Grid Config" : "Configure Grid"}
          </button>

          <button
            onClick={onTogglePinAll}
            className={`px-3 py-1.5 rounded flex items-center ${
              areAllPinned
                ? "bg-blue-600 text-white hover:bg-blue-500"
                : "bg-gray-600 text-white hover:bg-gray-500"
            }`}
          >
            <svg
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
            onClick={onShuffle}
            className="px-3 py-1.5 rounded flex items-center bg-purple-600 text-white hover:bg-purple-500"
            disabled={areAllPinned}
            title={
              areAllPinned ? "Unpin some albums to shuffle" : "Randomly rearrange unpinned albums"
            }
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-4 h-4 mr-1"
            >
              <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm0.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
            </svg>
            Shuffle
          </button>

          <div className="relative">
            <button
              onClick={onToggleExportDropdown}
              className="px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-500 flex items-center"
            >
              <span className="mr-1">Export</span>
              <svg
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
