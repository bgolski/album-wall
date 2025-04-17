import React, { useState, useRef } from "react";
import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  DragEndEvent,
  UniqueIdentifier,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { SortableRecord } from "./SortableRecord";
import { Album } from "../types/index";
import html2canvas from "html2canvas";

interface RecordGridProps {
  username: string;
  albums: Album[];
  onAlbumsReorder: (newAlbums: Album[]) => void;
}

type SortOption = "none" | "artist" | "genre";

// Default wall dimensions
const DEFAULT_ROWS = 4;
const DEFAULT_COLUMNS = 8;

export const RecordGrid: React.FC<RecordGridProps> = ({ username, albums, onAlbumsReorder }) => {
  // Grid dimensions state
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [rows, setRows] = useState(DEFAULT_ROWS);
  const [showDimensionsConfig, setShowDimensionsConfig] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>("none");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // Calculate grid size based on current dimensions
  const gridSize = rows * columns;

  // Ensure we only use the correct number of albums for the wall display
  const [displayedAlbums, setDisplayedAlbums] = useState<Album[]>(albums.slice(0, gridSize));
  const [poolItems, setPoolItems] = useState<Album[]>(albums.slice(gridSize));

  // Update albums and pool when dimensions or albums change
  React.useEffect(() => {
    // Recalculate based on current dimensions
    setDisplayedAlbums(albums.slice(0, gridSize));
    setPoolItems(albums.slice(gridSize));
  }, [albums, gridSize]);

  // Sorting function
  const sortAlbums = (albumsToSort: Album[], option: SortOption) => {
    if (option === "none") return albumsToSort;

    return [...albumsToSort].sort((a, b) => {
      if (option === "artist") {
        const artistA = a.artist || "";
        const artistB = b.artist || "";
        return artistA.localeCompare(artistB);
      } else if (option === "genre") {
        const genreA = a.genre?.[0] || "";
        const genreB = b.genre?.[0] || "";
        return genreA.localeCompare(genreB);
      }
      return 0;
    });
  };

  // Handle dimension changes
  const handleDimensionsChange = (newRows: number, newColumns: number) => {
    // Validate dimensions
    if (newRows < 1 || newColumns < 1) return;

    const newGridSize = newRows * newColumns;
    const oldGridSize = rows * columns;

    // Update dimensions
    setRows(newRows);
    setColumns(newColumns);

    // Redistribute albums if needed
    if (newGridSize !== oldGridSize) {
      const allAlbums = [...displayedAlbums, ...poolItems];
      setDisplayedAlbums(allAlbums.slice(0, newGridSize));
      setPoolItems(allAlbums.slice(newGridSize));
    }
  };

  // Handle sort change
  const handleSortChange = (option: SortOption) => {
    setSortOption(option);
    if (option === "none") {
      // Just keep current manual arrangement
      return;
    }
    // Sort both displayed albums and pool items
    const sortedDisplayed = sortAlbums(displayedAlbums, option);
    const sortedPool = sortAlbums(poolItems, option);

    setDisplayedAlbums(sortedDisplayed);
    setPoolItems(sortedPool);
  };

  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 8,
    },
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 200,
      tolerance: 8,
    },
  });

  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });

  const sensors = useSensors(mouseSensor, touchSensor, keyboardSensor);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // Get the containers of the dragged and target items
    const activeContainer = getContainerType(activeId);
    const overContainer = getContainerType(overId);

    if (activeContainer === overContainer) {
      // If in the same container, just reorder
      if (activeContainer === "grid") {
        const newDisplayedAlbums = arrayMove(
          displayedAlbums,
          displayedAlbums.findIndex((item) => `album-${item.id}` === activeId),
          displayedAlbums.findIndex((item) => `album-${item.id}` === overId)
        );
        setDisplayedAlbums(newDisplayedAlbums);

        // Also update the parent component with combined albums
        onAlbumsReorder([...newDisplayedAlbums, ...poolItems]);
      } else {
        const newPoolItems = arrayMove(
          poolItems,
          poolItems.findIndex((item) => `album-${item.id}` === activeId),
          poolItems.findIndex((item) => `album-${item.id}` === overId)
        );
        setPoolItems(newPoolItems);

        // Also update the parent component with combined albums
        onAlbumsReorder([...displayedAlbums, ...newPoolItems]);
      }
    } else {
      // Swap items between containers
      const activeIndex =
        activeContainer === "grid"
          ? displayedAlbums.findIndex((item) => `album-${item.id}` === activeId)
          : poolItems.findIndex((item) => `album-${item.id}` === activeId);

      const overIndex =
        overContainer === "grid"
          ? displayedAlbums.findIndex((item) => `album-${item.id}` === overId)
          : poolItems.findIndex((item) => `album-${item.id}` === overId);

      if (activeIndex === -1 || overIndex === -1) return;

      const activeItem =
        activeContainer === "grid" ? displayedAlbums[activeIndex] : poolItems[activeIndex];

      const overItem = overContainer === "grid" ? displayedAlbums[overIndex] : poolItems[overIndex];

      // Create new arrays with the items swapped
      const newDisplayedAlbums = [...displayedAlbums];
      const newPoolItems = [...poolItems];

      if (activeContainer === "grid") {
        newDisplayedAlbums[activeIndex] = overItem;
        newPoolItems[overIndex] = activeItem;
      } else {
        newPoolItems[activeIndex] = overItem;
        newDisplayedAlbums[overIndex] = activeItem;
      }

      setDisplayedAlbums(newDisplayedAlbums);
      setPoolItems(newPoolItems);

      // Also update the parent component with combined albums
      onAlbumsReorder([...newDisplayedAlbums, ...newPoolItems]);
    }
  }

  function getContainerType(id: UniqueIdentifier): "grid" | "pool" {
    return displayedAlbums.some((item) => `album-${item.id}` === id) ? "grid" : "pool";
  }

  // Export wall display to CSV
  const exportToCSV = () => {
    if (!displayedAlbums.length) return;

    // Create CSV content with headers
    const headers = ["Title", "Artist", "Genre"];
    const csvContent = displayedAlbums.map((album) => {
      const genreString = album.genre ? album.genre.join(", ") : "";
      return [album.title || "", album.artist || "", genreString].join(",");
    });

    // Add headers to the top
    csvContent.unshift(headers.join(","));

    // Create and download blob
    const blob = new Blob([csvContent.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    // Include username in the filename if available
    const fileName = username ? `${username}-vinyl-wall.csv` : "vinyl-wall.csv";
    link.setAttribute("download", fileName);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export wall display as image
  const exportAsImage = async () => {
    // Close dropdown
    setDropdownOpen(false);

    if (!gridRef.current) {
      console.error("Grid reference not found");
      return;
    }

    try {
      setIsExporting(true);

      // Temporarily hide labels for clean export
      const grid = gridRef.current;
      const labels = grid.querySelectorAll(".album-labels");
      labels.forEach((label) => {
        (label as HTMLElement).style.display = "none";
      });

      const canvas = await html2canvas(grid, {
        backgroundColor: null,
        useCORS: true,
        logging: false,
        scale: 2, // Higher quality
      });

      // Restore labels
      labels.forEach((label) => {
        (label as HTMLElement).style.display = "block";
      });

      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      // Include username in the filename if available
      const fileName = username ? `${username}-vinyl-wall.png` : "vinyl-wall.png";
      link.download = fileName;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Error exporting image:", error);
      alert("Failed to export image. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // Toggle dropdown
  const toggleDropdown = () => {
    setDropdownOpen((prev) => !prev);
  };

  // Get the sorted albums if needed
  const getSortedDisplayedAlbums = () => {
    return sortOption === "none" ? displayedAlbums : sortAlbums(displayedAlbums, sortOption);
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Control Bar */}
      <div className="bg-gray-800 p-4 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <h2 className="text-lg font-semibold text-white mr-4">Sort Records</h2>
            <div className="flex gap-4">
              <button
                onClick={() => handleSortChange("none")}
                className={`px-3 py-1.5 rounded ${
                  sortOption === "none"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-600 text-white hover:bg-gray-500"
                }`}
              >
                Custom Order
              </button>
              <button
                onClick={() => handleSortChange("artist")}
                className={`px-3 py-1.5 rounded ${
                  sortOption === "artist"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-600 text-white hover:bg-gray-500"
                }`}
              >
                Sort by Artist
              </button>
              <button
                onClick={() => handleSortChange("genre")}
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
              onClick={() => setShowDimensionsConfig((prev) => !prev)}
              className="px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-500"
            >
              {showDimensionsConfig ? "Hide Grid Config" : "Configure Grid"}
            </button>

            <div className="relative">
              <button
                onClick={toggleDropdown}
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
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10">
                  <div className="py-1">
                    <button
                      onClick={exportToCSV}
                      className="block w-full text-left px-4 py-2 text-gray-800 hover:bg-gray-100"
                    >
                      Export to CSV
                    </button>
                    <button
                      onClick={exportAsImage}
                      disabled={isExporting}
                      className="block w-full text-left px-4 py-2 text-gray-800 hover:bg-gray-100 disabled:opacity-50"
                    >
                      {isExporting ? "Generating image..." : "Save as Image"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Grid dimensions configuration UI */}
        {showDimensionsConfig && (
          <div className="bg-gray-700 p-3 rounded mt-3">
            <h3 className="text-white font-medium mb-3">Wall Display Dimensions</h3>
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <label htmlFor="rows" className="text-white">
                  Rows:
                </label>
                <input
                  id="rows"
                  type="number"
                  min="1"
                  max="10"
                  value={rows}
                  onChange={(e) => handleDimensionsChange(Number(e.target.value), columns)}
                  className="w-16 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="columns" className="text-white">
                  Columns:
                </label>
                <input
                  id="columns"
                  type="number"
                  min="1"
                  max="12"
                  value={columns}
                  onChange={(e) => handleDimensionsChange(rows, Number(e.target.value))}
                  className="w-16 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white"
                />
              </div>

              <p className="text-gray-300 text-sm">
                Total albums in display: <span className="font-semibold">{gridSize}</span>
              </p>

              <div className="ml-auto">
                <button
                  onClick={() => handleDimensionsChange(DEFAULT_ROWS, DEFAULT_COLUMNS)}
                  className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-500"
                >
                  Reset to Default (4×8)
                </button>
              </div>
            </div>

            <div className="mt-3 text-blue-300 text-xs">
              <p>
                Note: Changing dimensions will redistribute albums between the wall display and
                pool.
              </p>
            </div>
          </div>
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex flex-col gap-8">
          {/* Grid Section - Dynamically sized based on user configuration */}
          <div className="bg-gray-800 p-4 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4 text-white">
              Wall Display ({columns}×{rows} = {gridSize} albums)
            </h2>
            <div
              ref={gridRef}
              id="grid-container"
              className="grid gap-4"
              style={{
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${rows}, auto)`,
              }}
            >
              <SortableContext
                items={getSortedDisplayedAlbums().map((album) => `album-${album.id}`)}
                strategy={rectSortingStrategy}
              >
                {getSortedDisplayedAlbums().map((album) => (
                  <SortableRecord key={`grid-${album.id}`} album={album} exportMode={isExporting} />
                ))}
              </SortableContext>
            </div>
          </div>

          {/* Pool Section - All remaining albums */}
          {poolItems.length > 0 && (
            <div className="bg-gray-800 p-4 rounded-lg shadow">
              <h2 className="text-xl font-bold mb-4 text-white">
                Remaining Record Pool ({poolItems.length} albums)
              </h2>
              <div className="grid grid-cols-8 gap-4">
                <SortableContext
                  items={poolItems.map((album) => `album-${album.id}`)}
                  strategy={rectSortingStrategy}
                >
                  {poolItems.map((album) => (
                    <SortableRecord key={`pool-${album.id}`} album={album} exportMode={false} />
                  ))}
                </SortableContext>
              </div>
            </div>
          )}
        </div>
      </DndContext>
    </div>
  );
};
