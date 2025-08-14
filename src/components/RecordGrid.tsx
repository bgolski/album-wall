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
import { Album, Html2CanvasOptions } from "@/types";
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

  // For display in UI or logging
  const userDisplayName = username || "Anonymous";

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

  // Shuffle only the unpinned albums in the display
  const shuffleUnpinnedAlbums = () => {
    // Separate pinned and unpinned albums from the display
    const pinnedAlbumsArray: Album[] = [];
    const unpinnedAlbumsArray: Album[] = [];

    // Map to store original indices of pinned albums
    const pinnedIndicesMap = new Map<string, number>();

    // Sort displayed albums into pinned and unpinned arrays
    displayedAlbums.forEach((album, index) => {
      if (pinnedAlbums.has(String(album.id))) {
        pinnedAlbumsArray.push(album);
        pinnedIndicesMap.set(String(album.id), index);
      } else {
        unpinnedAlbumsArray.push(album);
      }
    });

    // Determine how many slots in the grid are available for unpinned albums
    const availableSlots = displayedAlbums.length - pinnedAlbumsArray.length;

    // Combine unpinned albums from display with pool items for shuffling
    const allUnpinnedAlbums = [...unpinnedAlbumsArray, ...poolItems];

    // Shuffle all unpinned albums
    const shuffledUnpinned = [...allUnpinnedAlbums].sort(() => Math.random() - 0.5);

    // Take only what we need for the display
    const unpinnedForDisplay = shuffledUnpinned.slice(0, availableSlots);

    // The rest goes to the pool
    const newPoolItems = shuffledUnpinned.slice(availableSlots);

    // Create a new array with the same length as displayedAlbums
    const newDisplayedAlbums: Album[] = new Array(displayedAlbums.length);

    // Place pinned albums back at their original positions
    pinnedAlbumsArray.forEach((pinnedAlbum) => {
      const albumId = String(pinnedAlbum.id);
      const originalIndex = pinnedIndicesMap.get(albumId);

      if (originalIndex !== undefined) {
        newDisplayedAlbums[originalIndex] = pinnedAlbum;
      }
    });

    // Fill empty spots with shuffled unpinned albums
    let unpinnedIndex = 0;
    for (let i = 0; i < newDisplayedAlbums.length; i++) {
      if (!newDisplayedAlbums[i] && unpinnedIndex < unpinnedForDisplay.length) {
        newDisplayedAlbums[i] = unpinnedForDisplay[unpinnedIndex++];
      }
    }

    // Update state with new arrangement
    setDisplayedAlbums(newDisplayedAlbums);
    setPoolItems(newPoolItems);

    // Also update the parent component with combined albums
    onAlbumsReorder([...newDisplayedAlbums, ...newPoolItems]);
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
          // Handle genre as either string or array
          const genreA =
            typeof a.genre === "string" ? a.genre : Array.isArray(a.genre) ? a.genre[0] || "" : "";
          const genreB =
            typeof b.genre === "string" ? b.genre : Array.isArray(b.genre) ? b.genre[0] || "" : "";
          return String(genreA).localeCompare(String(genreB));
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
        // Handle genre as either string or array
        const genreA =
          typeof a.genre === "string" ? a.genre : Array.isArray(a.genre) ? a.genre[0] || "" : "";
        const genreB =
          typeof b.genre === "string" ? b.genre : Array.isArray(b.genre) ? b.genre[0] || "" : "";
        return String(genreA).localeCompare(String(genreB));
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
    setDropdownOpen(false);

    if (!albums || albums.length === 0) {
      alert("No albums to export");
      return;
    }

    const csvHeader = "Artist,Title,Genre,Year\n";
    const csvContent = albums
      .map((album) => {
        const artist = album.artist.replace(/,/g, " ");
        const title = album.title.replace(/,/g, " ");
        const genre =
          album.genre && album.genre.length > 0 ? album.genre[0].replace(/,/g, " ") : "";
        const year = album.year || "";
        return `${artist},${title},${genre},${year}`;
      })
      .join("\n");

    const blob = new Blob([csvHeader + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.setAttribute("href", url);
    link.setAttribute("download", "vinyl_wall_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export wall display as image
  const exportAsImage = async () => {
    setDropdownOpen(false);

    if (!gridRef.current || albums.length === 0) {
      alert("No albums to export");
      return;
    }

    try {
      // Set exporting state to true while generating the image
      setIsExporting(true);

      // Temporarily hide labels for export
      const labels = gridRef.current.querySelectorAll(".album-labels");
      labels.forEach((label: Element) => {
        (label as HTMLElement).style.display = "none";
      });

      const canvas = await html2canvas(gridRef.current, {
        backgroundColor: "#121212",
        scale: window.devicePixelRatio * 2, // Higher quality
        logging: false,
        allowTaint: true,
        useCORS: true,
      } as Html2CanvasOptions);

      // Show labels again
      labels.forEach((label: Element) => {
        (label as HTMLElement).style.display = "block";
      });

      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `${userDisplayName}_vinyl_wall.png`;
      link.href = image;
      link.click();

      // Reset exporting state when done
      setIsExporting(false);
    } catch (error) {
      console.error("Error exporting image:", error);
      alert("Failed to export image. Please try again.");
      setIsExporting(false);
    }
  };

  // Toggle dropdown
  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
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
                  <path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z" />
                ) : (
                  <path d="M17 3H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v6h2.03v-6H19v-2c-1.66 0-3-1.34-3-3V5h1c.55 0 1-.45 1-1s-.45-1-1-1zm-6 8.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                )}
              </svg>
              {areAllPinned ? "Unpin All" : "Pin All"}
            </button>

            <button
              onClick={shuffleUnpinnedAlbums}
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
