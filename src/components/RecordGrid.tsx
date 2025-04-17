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
  const [pinnedAlbums, setPinnedAlbums] = useState<Set<string>>(new Set());
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

  // Toggle pin status for an album
  const togglePinAlbum = (albumId: string) => {
    setPinnedAlbums((prevPinned) => {
      const newPinned = new Set(prevPinned);
      if (newPinned.has(albumId)) {
        newPinned.delete(albumId);
      } else {
        newPinned.add(albumId);
      }
      return newPinned;
    });
  };

  // Toggle pin status for all displayed albums
  const togglePinAll = () => {
    // Check if all displayed albums are currently pinned
    const allPinned = displayedAlbums.every((album) => pinnedAlbums.has(String(album.id)));

    if (allPinned) {
      // If all are pinned, unpin all
      setPinnedAlbums((prev) => {
        const newPinned = new Set(prev);
        displayedAlbums.forEach((album) => {
          newPinned.delete(String(album.id));
        });
        return newPinned;
      });
    } else {
      // Otherwise, pin all displayed albums
      setPinnedAlbums((prev) => {
        const newPinned = new Set(prev);
        displayedAlbums.forEach((album) => {
          newPinned.add(String(album.id));
        });
        return newPinned;
      });
    }
  };

  // Determine if all displayed albums are pinned for button state
  const areAllPinned =
    displayedAlbums.length > 0 &&
    displayedAlbums.every((album) => pinnedAlbums.has(String(album.id)));

  // Sorting function
  const sortAlbums = (albumsToSort: Album[], option: SortOption) => {
    if (option === "none") return albumsToSort;

    // Keep pinned albums in their positions during sort
    if (pinnedAlbums.size > 0) {
      const pinnedIndices = new Map<string, number>();
      albumsToSort.forEach((album, index) => {
        if (pinnedAlbums.has(String(album.id))) {
          pinnedIndices.set(String(album.id), index);
        }
      });

      // Sort non-pinned albums
      const nonPinnedAlbums = albumsToSort.filter((album) => !pinnedAlbums.has(String(album.id)));
      const sortedNonPinned = [...nonPinnedAlbums].sort((a, b) => {
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

      // Create result array with all albums
      const result = new Array(albumsToSort.length);

      // Place pinned albums at their original positions
      pinnedIndices.forEach((index, albumId) => {
        const album = albumsToSort.find((a) => String(a.id) === albumId);
        if (album) {
          result[index] = album;
        }
      });

      // Fill empty slots with sorted non-pinned albums
      let nonPinnedIndex = 0;
      for (let i = 0; i < result.length; i++) {
        if (!result[i] && nonPinnedIndex < sortedNonPinned.length) {
          result[i] = sortedNonPinned[nonPinnedIndex++];
        }
      }

      return result.filter(Boolean); // Remove any undefined entries
    }

    // Regular sort if no pins
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

      // If grid size decreases, check for pinned albums that would be removed
      if (newGridSize < oldGridSize) {
        // Remove pins for albums that will no longer be in display
        setPinnedAlbums((prevPinned) => {
          const newPinned = new Set(prevPinned);
          displayedAlbums.forEach((album, index) => {
            if (index >= newGridSize && newPinned.has(String(album.id))) {
              newPinned.delete(String(album.id));
            }
          });
          return newPinned;
        });
      }

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

    // Extract album ID from the element ID (remove "album-" prefix)
    const activeAlbumId = String(activeId).replace("album-", "");
    const overAlbumId = String(overId).replace("album-", "");

    // Check if the target position is occupied by a pinned album
    if (pinnedAlbums.has(overAlbumId)) {
      // If trying to drop onto a pinned album, don't allow the swap
      return;
    }

    // Get the containers of the dragged and target items
    const activeContainer = getContainerType(activeId);
    const overContainer = getContainerType(overId);

    if (activeContainer === overContainer) {
      // If in the same container, just reorder
      if (activeContainer === "grid") {
        // Get the subset of albums that are not pinned
        const unpinnedAlbums = displayedAlbums.filter(
          (album) => !pinnedAlbums.has(String(album.id))
        );

        // Find the indices of the dragged and target items within the unpinned subset
        const unpinnedActiveIndex = unpinnedAlbums.findIndex(
          (album) => String(album.id) === activeAlbumId
        );
        const unpinnedOverIndex = unpinnedAlbums.findIndex(
          (album) => String(album.id) === overAlbumId
        );

        // Reorder just the unpinned albums
        const reorderedUnpinned = arrayMove(unpinnedAlbums, unpinnedActiveIndex, unpinnedOverIndex);

        // Create the new album order by inserting pinned albums at their fixed positions
        const newDisplayedAlbums: Album[] = [];

        // For each position in the grid, determine what album should be there
        for (let i = 0; i < displayedAlbums.length; i++) {
          const originalAlbumAtPosition = displayedAlbums[i];
          const albumId = String(originalAlbumAtPosition.id);

          // If this position had a pinned album, keep it there
          if (pinnedAlbums.has(albumId)) {
            newDisplayedAlbums.push(originalAlbumAtPosition);
          } else {
            // Otherwise, take the next unpinned album from our reordered list
            if (reorderedUnpinned.length > 0) {
              newDisplayedAlbums.push(reorderedUnpinned.shift()!);
            }
          }
        }

        // If we have any remaining unpinned albums (unlikely but for safety), add them at the end
        if (reorderedUnpinned.length > 0) {
          newDisplayedAlbums.push(...reorderedUnpinned);
        }

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
        // Moving from grid to pool means unpinning the album
        if (pinnedAlbums.has(String(activeItem.id))) {
          setPinnedAlbums((prev) => {
            const newPinned = new Set(prev);
            newPinned.delete(String(activeItem.id));
            return newPinned;
          });
        }

        // Remove from grid
        newDisplayedAlbums.splice(activeIndex, 1);

        // Find the right insertion spot in the pool
        newPoolItems.splice(overIndex, 0, activeItem);

        // Insert the pool item into the grid, respecting pinned positions
        // Find the first unpinned position at or after the target index
        let insertIndex = overIndex;
        while (
          insertIndex < newDisplayedAlbums.length &&
          pinnedAlbums.has(String(newDisplayedAlbums[insertIndex].id))
        ) {
          insertIndex++;
        }

        // Insert at the found position or at the end if all remaining positions are pinned
        if (insertIndex < newDisplayedAlbums.length) {
          newDisplayedAlbums.splice(insertIndex, 0, overItem);
        } else {
          newDisplayedAlbums.push(overItem);
        }
      } else {
        // Moving from pool to grid
        // Remove from pool
        newPoolItems.splice(activeIndex, 1);

        // Find the right insertion spot in the grid, respecting pinned positions
        if (pinnedAlbums.has(String(overItem.id))) {
          // Can't replace a pinned item, find the next available unpinned spot
          let insertIndex = overIndex;
          while (
            insertIndex < newDisplayedAlbums.length &&
            pinnedAlbums.has(String(newDisplayedAlbums[insertIndex].id))
          ) {
            insertIndex++;
          }

          // Insert at the found position or at the end if all remaining positions are pinned
          if (insertIndex < newDisplayedAlbums.length) {
            newDisplayedAlbums.splice(insertIndex, 0, activeItem);
          } else {
            newDisplayedAlbums.push(activeItem);
          }
        } else {
          // Normal case, just insert at the target position
          newDisplayedAlbums.splice(overIndex, 0, activeItem);
        }
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

            <button
              onClick={togglePinAll}
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
                  <path d="M20.2349 14.61C19.8599 12.865 20.4649 11.03 21.8149 9.675L21.8199 9.67C22.1237 9.3653 22.1242 8.8698 21.8199 8.565C21.5125 8.2569 21.5125 7.7431 21.8199 7.435L22.5699 6.685C22.8699 6.385 22.8699 5.915 22.5699 5.615L18.3849 1.43C18.0849 1.13 17.6149 1.13 17.3149 1.43L16.5649 2.18C16.2599 2.485 15.7449 2.485 15.4399 2.18C15.1338 1.873 14.6348 1.873 14.3299 2.18L14.3249 2.185C12.9749 3.535 11.1349 4.14 9.39488 3.765C7.25988 3.3 4.95488 4.01 3.35488 5.605L3.24988 5.71C3.05988 5.9 3.05988 6.2 3.24988 6.39L17.6149 20.75C17.8049 20.94 18.1049 20.94 18.2949 20.75L18.3999 20.645C19.9949 19.045 20.7049 16.745 20.2349 14.61Z" />
                ) : (
                  <path d="M16 12V6c0-2.21-1.79-4-4-4S8 3.79 8 6v6h8zm-4 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
                )}
              </svg>
              {areAllPinned ? "Unpin All" : "Pin All"}
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
              {pinnedAlbums.size > 0 && (
                <span className="ml-2 text-blue-300 text-sm font-normal">
                  ({pinnedAlbums.size} pinned)
                </span>
              )}
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
                  <SortableRecord
                    key={`grid-${album.id}`}
                    album={album}
                    exportMode={isExporting}
                    isPinned={pinnedAlbums.has(String(album.id))}
                    onPinToggle={togglePinAlbum}
                  />
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
                    <SortableRecord
                      key={`pool-${album.id}`}
                      album={album}
                      exportMode={false}
                      isPinned={false} // Pool items can't be pinned
                      disablePinning={true} // Disable pin toggle for pool items
                    />
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
