import React, { useState, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  UniqueIdentifier,
  MouseSensor,
  TouchSensor,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableRecord } from "./SortableRecord";
import { Album } from "../types/index";
import html2canvas from "html2canvas";

interface RecordGridProps {
  username: string;
  albums: Album[];
  onAlbumsReorder: (newAlbums: Album[]) => void;
  showPlaceholders?: boolean;
  loading?: boolean;
}

type SortOption = "none" | "artist" | "genre";

const GRID_SIZE = 32; // 8x4 grid

export const RecordGrid: React.FC<RecordGridProps> = ({
  username,
  albums,
  onAlbumsReorder,
  showPlaceholders = false,
  loading = false,
}) => {
  // Ensure we only use the first 32 albums for the wall display
  const [displayedAlbums, setDisplayedAlbums] = useState<Album[]>(albums.slice(0, GRID_SIZE));
  const [poolItems, setPoolItems] = useState<Album[]>(albums.slice(GRID_SIZE));
  const [sortOption, setSortOption] = useState<SortOption>("none");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // Update albums when they change from props
  React.useEffect(() => {
    setDisplayedAlbums(albums.slice(0, GRID_SIZE));
    setPoolItems(albums.slice(GRID_SIZE));
  }, [albums]);

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

  const sensors = useSensors(mouseSensor, touchSensor);

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
      let newDisplayedAlbums = [...displayedAlbums];
      let newPoolItems = [...poolItems];

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
    link.setAttribute("download", "vinyl-wall-export.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export wall display as image
  const exportAsImage = async () => {
    // Close dropdown
    setDropdownOpen(false);
    setIsExporting(true);

    // Make sure we have the wall display grid section
    const wallDisplayGrid = gridRef.current;
    if (!wallDisplayGrid || displayedAlbums.length === 0) {
      alert("No albums to export or grid not rendered.");
      setIsExporting(false);
      return;
    }

    try {
      // First enable export mode to convert images to data URLs
      setIsExporting(true);

      // Give time for components to enter export mode and convert images
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Hide album information labels
      const labels = wallDisplayGrid.querySelectorAll(".album-labels");
      labels.forEach((label) => {
        (label as HTMLElement).style.display = "none";
      });

      // Wait a bit more to ensure all styling updates are applied
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Capture ONLY the wall display grid section
      const canvas = await html2canvas(wallDisplayGrid, {
        backgroundColor: "#1a1a1a",
        scale: 2, // Higher resolution
        useCORS: true,
        allowTaint: true,
        logging: true,
      });

      // Restore labels
      labels.forEach((label) => {
        (label as HTMLElement).style.display = "";
      });

      // Convert to PNG and download
      canvas.toBlob((blob) => {
        if (!blob) {
          console.error("Failed to create blob from canvas");
          alert("Failed to generate image. Please try again.");
          return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${username}-vinyl-wall.png`;
        link.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    } catch (error) {
      console.error("Error exporting as image:", error);
      alert("Failed to export as image. Please try again.");
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
      {/* Sorting Controls */}
      <div className="bg-gray-800 p-4 rounded-lg shadow">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold text-white">Sort Records</h2>
          <div className="relative">
            <button
              onClick={toggleDropdown}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center"
            >
              Export
              <svg
                className={`ml-2 h-4 w-4 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                ></path>
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
        <div className="flex gap-4">
          <button
            onClick={() => handleSortChange("none")}
            className={`px-4 py-2 rounded ${
              sortOption === "none"
                ? "bg-blue-500 text-white"
                : "bg-gray-600 text-white hover:bg-gray-500"
            }`}
          >
            Custom Order
          </button>
          <button
            onClick={() => handleSortChange("artist")}
            className={`px-4 py-2 rounded ${
              sortOption === "artist"
                ? "bg-blue-500 text-white"
                : "bg-gray-600 text-white hover:bg-gray-500"
            }`}
          >
            Sort by Artist
          </button>
          <button
            onClick={() => handleSortChange("genre")}
            className={`px-4 py-2 rounded ${
              sortOption === "genre"
                ? "bg-blue-500 text-white"
                : "bg-gray-600 text-white hover:bg-gray-500"
            }`}
          >
            Sort by Genre
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex flex-col gap-8">
          {/* Grid Section - Exactly 8x4 = 32 albums */}
          <div className="bg-gray-800 p-4 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4 text-white">Wall Display (8x4)</h2>
            <div ref={gridRef} id="grid-container" className="grid grid-cols-8 gap-4">
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
