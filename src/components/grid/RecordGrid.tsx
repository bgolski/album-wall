import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  DragEndEvent,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Album } from "@/types";
import { useGridDimensions } from "@/hooks/useGridDimensions";
import { useAlbumPinning } from "@/hooks/useAlbumPinning";
import { useAlbumSorting } from "@/hooks/useAlbumSorting";
import { useGridExport } from "@/hooks/useGridExport";
import { useAlbumShuffle } from "@/hooks/useAlbumShuffle";
import {
  getContainerType,
  reorderWithinGrid,
  swapBetweenContainers,
} from "@/utils/dragAndDropHelpers";
import { GridControls } from "./GridControls";
import { GridDimensionsConfig } from "./GridDimensionsConfig";
import { ExportDropdown } from "./ExportDropdown";
import { WallDisplay } from "./WallDisplay";
import { PoolDisplay } from "./PoolDisplay";

interface RecordGridProps {
  username: string;
  albums: Album[];
  onAlbumsReorder: (newAlbums: Album[]) => void;
}

export function RecordGrid({ username, albums, onAlbumsReorder }: RecordGridProps) {
  // Use custom hooks for state management
  const dimensions = useGridDimensions();
  const pinning = useAlbumPinning();
  const sorting = useAlbumSorting();
  const exportHooks = useGridExport(username, albums);
  const { shuffleUnpinnedAlbums } = useAlbumShuffle();

  // Album distribution state
  const [displayedAlbums, setDisplayedAlbums] = useState<Album[]>(
    albums.slice(0, dimensions.gridSize)
  );
  const [poolItems, setPoolItems] = useState<Album[]>(albums.slice(dimensions.gridSize));

  // Update albums and pool when dimensions or albums change
  useEffect(() => {
    const newGridSize = dimensions.gridSize;
    const oldGridSize = displayedAlbums.length;

    if (newGridSize !== oldGridSize) {
      const allAlbums = [...displayedAlbums, ...poolItems];

      // If grid size decreases, remove pins for albums that will no longer be in display
      if (newGridSize < oldGridSize) {
        const albumsToUnpin = displayedAlbums.slice(newGridSize).map((album) => String(album.id));
        pinning.removePinsForAlbums(albumsToUnpin);
      }

      setDisplayedAlbums(allAlbums.slice(0, newGridSize));
      setPoolItems(allAlbums.slice(newGridSize));
    }
  }, [dimensions.gridSize, displayedAlbums, poolItems, pinning]);

  useEffect(() => {
    setDisplayedAlbums(albums.slice(0, dimensions.gridSize));
    setPoolItems(albums.slice(dimensions.gridSize));
  }, [albums, dimensions.gridSize]);

  // Handle sorting
  const handleSortChange = (option: typeof sorting.sortOption) => {
    sorting.handleSortChange(option);
    if (option === "none") return;

    const sortedDisplayed = sorting.sortAlbums(displayedAlbums, pinning.pinnedAlbums);
    const sortedPool = sorting.sortAlbums(poolItems, pinning.pinnedAlbums);

    setDisplayedAlbums(sortedDisplayed);
    setPoolItems(sortedPool);
  };

  // Handle shuffle
  const handleShuffle = () => {
    const { newDisplayedAlbums, newPoolItems } = shuffleUnpinnedAlbums(
      displayedAlbums,
      poolItems,
      pinning.pinnedAlbums
    );

    setDisplayedAlbums(newDisplayedAlbums);
    setPoolItems(newPoolItems);
    onAlbumsReorder([...newDisplayedAlbums, ...newPoolItems]);
  };

  // Handle dimensions change
  const handleDimensionsChange = (newRows: number, newColumns: number) => {
    dimensions.handleDimensionsChange(newRows, newColumns);
  };

  // Drag and drop sensors
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: { distance: 8 },
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 8 },
  });

  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });

  const sensors = useSensors(mouseSensor, touchSensor, keyboardSensor);

  // Handle drag end
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // Extract album ID from the element ID (remove "album-" prefix)
    const activeAlbumId = String(activeId).replace("album-", "");
    const overAlbumId = String(overId).replace("album-", "");

    // Check if the target position is occupied by a pinned album
    if (pinning.pinnedAlbums.has(overAlbumId)) {
      return;
    }

    // Get the containers of the dragged and target items
    const activeContainer = getContainerType(activeId, displayedAlbums);
    const overContainer = getContainerType(overId, displayedAlbums);

    if (activeContainer === overContainer) {
      // Reorder within the same container
      if (activeContainer === "grid") {
        const newDisplayedAlbums = reorderWithinGrid(
          displayedAlbums,
          activeAlbumId,
          overAlbumId,
          pinning.pinnedAlbums
        );
        setDisplayedAlbums(newDisplayedAlbums);
        onAlbumsReorder([...newDisplayedAlbums, ...poolItems]);
      } else {
        const newPoolItems = arrayMove(
          poolItems,
          poolItems.findIndex((item) => `album-${item.id}` === activeId),
          poolItems.findIndex((item) => `album-${item.id}` === overId)
        );
        setPoolItems(newPoolItems);
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

      const { newDisplayedAlbums, newPoolItems } = swapBetweenContainers(
        displayedAlbums,
        poolItems,
        activeIndex,
        overIndex,
        activeContainer,
        overContainer,
        pinning.pinnedAlbums
      );

      // Moving from grid to pool means unpinning the album
      if (activeContainer === "grid") {
        const activeItem = displayedAlbums[activeIndex];
        if (pinning.pinnedAlbums.has(String(activeItem.id))) {
          pinning.togglePinAlbum(String(activeItem.id));
        }
      }

      setDisplayedAlbums(newDisplayedAlbums);
      setPoolItems(newPoolItems);
      onAlbumsReorder([...newDisplayedAlbums, ...newPoolItems]);
    }
  }

  // Get sorted albums for display
  const getSortedDisplayedAlbums = () => {
    return sorting.sortOption === "none"
      ? displayedAlbums
      : sorting.sortAlbums(displayedAlbums, pinning.pinnedAlbums);
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Control Bar */}
      <div className="relative">
        <GridControls
          sortOption={sorting.sortOption}
          areAllPinned={pinning.areAllPinned(displayedAlbums)}
          onSortChange={handleSortChange}
          onToggleDimensionsConfig={dimensions.toggleConfig}
          onTogglePinAll={() => pinning.togglePinAll(displayedAlbums)}
          onShuffle={handleShuffle}
          onToggleExportDropdown={exportHooks.toggleDropdown}
          showDimensionsConfig={dimensions.showDimensionsConfig}
        />

        {/* Export Dropdown positioned absolutely */}
        <ExportDropdown
          isOpen={exportHooks.dropdownOpen}
          isExporting={exportHooks.isExporting}
          onExportCSV={exportHooks.exportToCSV}
          onExportImage={exportHooks.exportAsImage}
        />

        {/* Grid Dimensions Configuration */}
        <GridDimensionsConfig
          isVisible={dimensions.showDimensionsConfig}
          rows={dimensions.rows}
          columns={dimensions.columns}
          gridSize={dimensions.gridSize}
          defaultRows={dimensions.DEFAULT_ROWS}
          defaultColumns={dimensions.DEFAULT_COLUMNS}
          onDimensionsChange={handleDimensionsChange}
          onReset={dimensions.resetToDefault}
        />
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex flex-col gap-8">
          {/* Wall Display */}
          <WallDisplay
            albums={getSortedDisplayedAlbums()}
            columns={dimensions.columns}
            rows={dimensions.rows}
            gridSize={dimensions.gridSize}
            pinnedCount={pinning.pinnedAlbums.size}
            isExporting={exportHooks.isExporting}
            pinnedAlbums={pinning.pinnedAlbums}
            onPinToggle={pinning.togglePinAlbum}
            gridRef={exportHooks.gridRef}
          />

          {/* Pool Display */}
          <PoolDisplay albums={poolItems} />
        </div>
      </DndContext>
    </div>
  );
}
