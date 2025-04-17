import { useState, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  UniqueIdentifier,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableRecord } from "./SortableRecord";
import { Album } from "@/types";
import html2canvas from "html2canvas";

interface RecordGridProps {
  albums: Album[];
}

type SortOption = "none" | "artist" | "genre";

const GRID_SIZE = 32; // 8x4 grid

export function RecordGrid({ albums }: RecordGridProps) {
  const [gridItems, setGridItems] = useState(albums.slice(0, GRID_SIZE));
  const [poolItems, setPoolItems] = useState(albums.slice(GRID_SIZE));
  const [sortOption, setSortOption] = useState<SortOption>("none");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // Sorting function
  const sortAlbums = (albums: Album[], option: SortOption) => {
    if (option === "none") return albums;

    return [...albums].sort((a, b) => {
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
    setGridItems(sortAlbums(gridItems, option));
    setPoolItems(sortAlbums(poolItems, option));
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
        setGridItems((items) => {
          const oldIndex = items.findIndex((item) => item.id === activeId);
          const newIndex = items.findIndex((item) => item.id === overId);
          return arrayMove(items, oldIndex, newIndex);
        });
      } else {
        setPoolItems((items) => {
          const oldIndex = items.findIndex((item) => item.id === activeId);
          const newIndex = items.findIndex((item) => item.id === overId);
          return arrayMove(items, oldIndex, newIndex);
        });
      }
    } else {
      // Swap items between containers
      const activeItem =
        activeContainer === "grid"
          ? gridItems.find((item) => item.id === activeId)
          : poolItems.find((item) => item.id === activeId);

      const overItem =
        overContainer === "grid"
          ? gridItems.find((item) => item.id === overId)
          : poolItems.find((item) => item.id === overId);

      if (!activeItem || !overItem) return;

      if (activeContainer === "grid") {
        setGridItems((items) =>
          items.map((item) =>
            item.id === activeId
              ? overItem
              : item.id === overId
              ? activeItem
              : item
          )
        );
        setPoolItems((items) =>
          items.map((item) =>
            item.id === overId
              ? activeItem
              : item.id === activeId
              ? overItem
              : item
          )
        );
      } else {
        setPoolItems((items) =>
          items.map((item) =>
            item.id === activeId
              ? overItem
              : item.id === overId
              ? activeItem
              : item
          )
        );
        setGridItems((items) =>
          items.map((item) =>
            item.id === overId
              ? activeItem
              : item.id === activeId
              ? overItem
              : item
          )
        );
      }
    }
  }

  function getContainerType(id: UniqueIdentifier): "grid" | "pool" {
    return gridItems.find((item) => item.id === id) ? "grid" : "pool";
  }

  // Export wall display to CSV
  const exportToCSV = () => {
    // Create CSV headers
    const headers = [
      "Position",
      "Artist",
      "Album Title",
      "ID",
      "Section",
      "Cover Image",
    ];

    // Create CSV rows for grid items
    const gridRows = gridItems.map((album, index) => {
      const position = `${Math.floor(index / 8) + 1},${(index % 8) + 1}`; // Row,Column format
      return [
        position,
        album.artist,
        album.title,
        album.id,
        "grid",
        album.cover_image,
      ].join(",");
    });

    // Create CSV rows for pool items
    const poolRows = poolItems.map((album) => {
      return [
        "pool",
        album.artist,
        album.title,
        album.id,
        "pool",
        album.cover_image,
      ].join(",");
    });

    // Combine headers and rows
    const csvContent = [headers.join(","), ...gridRows, ...poolRows].join("\n");

    // Create blob and download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "vinyl_wall_arrangement.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Close dropdown
    setDropdownOpen(false);
  };

  // Export wall display as image
  const exportAsImage = async () => {
    if (!gridRef.current) return;

    try {
      // Temporarily hide labels for the screenshot
      const labels = gridRef.current.querySelectorAll(".album-labels");
      labels.forEach((label) => {
        (label as HTMLElement).style.display = "none";
      });

      // Take screenshot
      const canvas = await html2canvas(gridRef.current, {
        backgroundColor: "#1f2937", // Match the background color
        scale: 2, // Higher quality
      });

      // Restore labels
      labels.forEach((label) => {
        (label as HTMLElement).style.display = "block";
      });

      // Convert to data URL and download
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = "vinyl_wall.png";
      link.href = dataUrl;
      link.click();

      // Close dropdown
      setDropdownOpen(false);
    } catch (error) {
      console.error("Error exporting as image:", error);
    }
  };

  // Toggle dropdown
  const toggleDropdown = () => {
    setDropdownOpen((prev) => !prev);
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
                className={`ml-2 h-4 w-4 transition-transform ${
                  dropdownOpen ? "rotate-180" : ""
                }`}
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
                    className="block w-full text-left px-4 py-2 text-gray-800 hover:bg-gray-100"
                  >
                    Save as Image
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col gap-8">
          {/* Grid Section */}
          <div className="bg-gray-800 p-4 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4 text-white">
              Wall Display (8x4)
            </h2>
            <div ref={gridRef} className="grid grid-cols-8 gap-4">
              <SortableContext
                items={gridItems.map((i) => i.id)}
                strategy={rectSortingStrategy}
              >
                {gridItems.map((album) => (
                  <SortableRecord key={album.id} album={album} />
                ))}
              </SortableContext>
            </div>
          </div>

          {/* Pool Section */}
          <div className="bg-gray-800 p-4 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4 text-white">
              Remaining Record Pool
            </h2>
            <div className="grid grid-cols-8 gap-4">
              <SortableContext
                items={poolItems.map((i) => i.id)}
                strategy={rectSortingStrategy}
              >
                {poolItems.map((album) => (
                  <SortableRecord key={album.id} album={album} />
                ))}
              </SortableContext>
            </div>
          </div>
        </div>
      </DndContext>
    </div>
  );
}
