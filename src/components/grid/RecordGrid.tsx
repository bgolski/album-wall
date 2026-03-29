import { useState, useEffect, useMemo, useRef } from "react";
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
import { Album, SharedWallState } from "@/types";
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
import { buildSharedWallState, buildSharedWallUrl } from "@/utils/shareState";
import { GridControls } from "./GridControls";
import { GridDimensionsConfig } from "./GridDimensionsConfig";
import { ExportDropdown } from "./ExportDropdown";
import { WallDisplay } from "./WallDisplay";
import { PoolDisplay } from "./PoolDisplay";

interface RecordGridProps {
  username: string;
  albums: Album[];
  onAlbumsReorder: (newAlbums: Album[]) => void;
  sharedWallState?: SharedWallState | null;
}

function buildAlbumsFromSharedWallState(albums: Album[], sharedWallState: SharedWallState) {
  const albumMap = new Map(albums.map((album) => [String(album.id), album]));
  const sharedWallAlbums = sharedWallState.wallAlbumIds
    .map((albumId) => albumMap.get(albumId))
    .filter((album): album is Album => Boolean(album));
  const sharedWallAlbumIds = new Set(sharedWallAlbums.map((album) => String(album.id)));
  const remainingAlbums = albums.filter((album) => !sharedWallAlbumIds.has(String(album.id)));

  return [...sharedWallAlbums, ...remainingAlbums];
}

/**
 * Coordinates wall-grid interactions including sorting, pinning, shuffling, exporting,
 * dimension changes, and drag-and-drop between the wall and pool.
 */
export function RecordGrid({
  username,
  albums,
  onAlbumsReorder,
  sharedWallState,
}: RecordGridProps) {
  const sharedStateSignature = useMemo(
    () => (sharedWallState ? JSON.stringify(sharedWallState) : null),
    [sharedWallState]
  );
  const appliedSharedStateSignatureRef = useRef<string | null>(null);
  const initialDimensions =
    sharedWallState && sharedWallState.username === username
      ? { rows: sharedWallState.rows, columns: sharedWallState.columns }
      : undefined;
  const shareRows = sharedWallState?.rows;
  const shareColumns = sharedWallState?.columns;
  const shareUsername = sharedWallState?.username;

  // Use custom hooks for state management
  const dimensions = useGridDimensions(initialDimensions);
  const pinning = useAlbumPinning(
    sharedWallState?.username === username ? sharedWallState.pinnedAlbumIds : undefined
  );
  const sorting = useAlbumSorting();
  const exportHooks = useGridExport(username, albums);
  const { shuffleUnpinnedAlbums } = useAlbumShuffle();
  const {
    rows,
    columns,
    gridSize,
    showDimensionsConfig,
    handleDimensionsChange: updateGridDimensions,
    replaceDimensions,
    resetToDefault,
    toggleConfig,
    DEFAULT_ROWS,
    DEFAULT_COLUMNS,
  } = dimensions;
  const {
    pinnedAlbums,
    togglePinAlbum,
    togglePinAll,
    removePinsForAlbums,
    replacePinnedAlbums,
    areAllPinned,
  } = pinning;

  // Album distribution state
  const [displayedAlbums, setDisplayedAlbums] = useState<Album[]>(albums.slice(0, gridSize));
  const [poolItems, setPoolItems] = useState<Album[]>(albums.slice(gridSize));
  const [shareStatusMessage, setShareStatusMessage] = useState<string | null>(null);

  // Update albums and pool when dimensions or albums change
  useEffect(() => {
    const newGridSize = gridSize;
    const oldGridSize = displayedAlbums.length;

    if (newGridSize !== oldGridSize) {
      const allAlbums = [...displayedAlbums, ...poolItems];

      // If grid size decreases, remove pins for albums that will no longer be in display
      if (newGridSize < oldGridSize) {
        const albumsToUnpin = displayedAlbums.slice(newGridSize).map((album) => String(album.id));
        removePinsForAlbums(albumsToUnpin);
      }

      setDisplayedAlbums(allAlbums.slice(0, newGridSize));
      setPoolItems(allAlbums.slice(newGridSize));
    }
  }, [displayedAlbums, gridSize, poolItems, removePinsForAlbums]);

  useEffect(() => {
    if (sharedWallState && shareUsername === username && sharedStateSignature) {
      if (appliedSharedStateSignatureRef.current === sharedStateSignature) {
        setDisplayedAlbums(albums.slice(0, gridSize));
        setPoolItems(albums.slice(gridSize));
        return;
      }

      if (rows !== shareRows || columns !== shareColumns) {
        replaceDimensions(shareRows!, shareColumns!);
        return;
      }

      const orderedAlbums = buildAlbumsFromSharedWallState(albums, sharedWallState);
      const validPinnedAlbumIds = sharedWallState.pinnedAlbumIds.filter((albumId) =>
        sharedWallState.wallAlbumIds.includes(albumId)
      );

      replacePinnedAlbums(validPinnedAlbumIds);
      setDisplayedAlbums(orderedAlbums.slice(0, gridSize));
      setPoolItems(orderedAlbums.slice(gridSize));
      onAlbumsReorder(orderedAlbums);
      appliedSharedStateSignatureRef.current = sharedStateSignature;
      return;
    }

    setDisplayedAlbums(albums.slice(0, gridSize));
    setPoolItems(albums.slice(gridSize));
  }, [
    albums,
    columns,
    gridSize,
    onAlbumsReorder,
    replaceDimensions,
    replacePinnedAlbums,
    rows,
    shareColumns,
    sharedStateSignature,
    sharedWallState,
    shareRows,
    shareUsername,
    username,
  ]);

  /**
   * Applies the selected sort mode to the grid and pool while preserving pinned positions.
   *
   * @param option Sort mode selected from the control bar.
   */
  const handleSortChange = (option: typeof sorting.sortOption) => {
    sorting.handleSortChange(option);
    if (option === "none") return;

    const sortedDisplayed = sorting.sortAlbums(displayedAlbums, pinnedAlbums);
    const sortedPool = sorting.sortAlbums(poolItems, pinnedAlbums);

    setDisplayedAlbums(sortedDisplayed);
    setPoolItems(sortedPool);
  };

  /**
   * Randomizes only unpinned albums across the grid and pool, then syncs the new order upward.
   */
  const handleShuffle = () => {
    const { newDisplayedAlbums, newPoolItems } = shuffleUnpinnedAlbums(
      displayedAlbums,
      poolItems,
      pinnedAlbums
    );

    setDisplayedAlbums(newDisplayedAlbums);
    setPoolItems(newPoolItems);
    onAlbumsReorder([...newDisplayedAlbums, ...newPoolItems]);
  };

  /**
   * Updates the wall dimensions through the grid-dimension hook.
   *
   * @param newRows Desired number of grid rows.
   * @param newColumns Desired number of grid columns.
   */
  const handleDimensionsChange = (newRows: number, newColumns: number) => {
    updateGridDimensions(newRows, newColumns);
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

  /**
   * Reorders albums after a drag operation while respecting pinned slots and container boundaries.
   *
   * @param event DnD Kit drag end event.
   */
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
          pinnedAlbums
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
        pinnedAlbums
      );

      // Moving from grid to pool means unpinning the album
      if (activeContainer === "grid") {
        const activeItem = displayedAlbums[activeIndex];
        if (pinnedAlbums.has(String(activeItem.id))) {
          togglePinAlbum(String(activeItem.id));
        }
      }

      setDisplayedAlbums(newDisplayedAlbums);
      setPoolItems(newPoolItems);
      onAlbumsReorder([...newDisplayedAlbums, ...newPoolItems]);
    }
  }

  /**
   * Returns the wall albums in their current display order, applying the active sort when needed.
   *
   * @returns Albums to render in the wall grid.
   */
  const getSortedDisplayedAlbums = () => {
    return sorting.sortOption === "none"
      ? displayedAlbums
      : sorting.sortAlbums(displayedAlbums, pinnedAlbums);
  };

  /**
   * Copies a shareable hash URL for the current wall configuration to the clipboard.
   */
  const handleCopyShareLink = async () => {
    if (typeof window === "undefined" || !username) {
      setShareStatusMessage("Unable to build a share link yet.");
      return;
    }

    const currentWallAlbums = getSortedDisplayedAlbums();
    const sharedWallStatePayload = buildSharedWallState({
      username,
      rows,
      columns,
      wallAlbumIds: currentWallAlbums.map((album) => String(album.id)),
      pinnedAlbumIds: Array.from(pinnedAlbums).filter((albumId) =>
        currentWallAlbums.some((album) => String(album.id) === albumId)
      ),
    });
    const shareUrl = buildSharedWallUrl(sharedWallStatePayload, window.location.href);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = shareUrl;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "absolute";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }

      setShareStatusMessage("Share link copied.");
    } catch (error) {
      console.error("Error copying share link:", error);
      setShareStatusMessage("Unable to copy link.");
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Control Bar */}
      <div className="relative">
        <GridControls
          sortOption={sorting.sortOption}
          areAllPinned={areAllPinned(displayedAlbums)}
          onSortChange={handleSortChange}
          onToggleDimensionsConfig={toggleConfig}
          onTogglePinAll={() => togglePinAll(displayedAlbums)}
          onShuffle={handleShuffle}
          onToggleExportDropdown={exportHooks.toggleDropdown}
          showDimensionsConfig={showDimensionsConfig}
        />

        {/* Export Dropdown positioned absolutely */}
        <ExportDropdown
          isOpen={exportHooks.dropdownOpen}
          isExporting={exportHooks.isExporting}
          statusMessage={shareStatusMessage ?? exportHooks.statusMessage}
          onExportCSV={exportHooks.exportToCSV}
          onExportImage={exportHooks.exportAsImage}
          onShareImage={exportHooks.shareImage}
          onCopyShareLink={handleCopyShareLink}
        />

        {/* Grid Dimensions Configuration */}
        <GridDimensionsConfig
          isVisible={showDimensionsConfig}
          rows={rows}
          columns={columns}
          gridSize={gridSize}
          defaultRows={DEFAULT_ROWS}
          defaultColumns={DEFAULT_COLUMNS}
          onDimensionsChange={handleDimensionsChange}
          onReset={resetToDefault}
        />
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex flex-col gap-8">
          {/* Wall Display */}
          <WallDisplay
            albums={getSortedDisplayedAlbums()}
            columns={columns}
            rows={rows}
            gridSize={gridSize}
            pinnedCount={pinnedAlbums.size}
            isExporting={exportHooks.isExporting}
            pinnedAlbums={pinnedAlbums}
            onPinToggle={togglePinAlbum}
            gridRef={exportHooks.gridRef}
          />

          {/* Pool Display */}
          <PoolDisplay albums={poolItems} />
        </div>
      </DndContext>
    </div>
  );
}
