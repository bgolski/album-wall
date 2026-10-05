import { useEffect, useState, useId, useMemo, useRef, useSyncExternalStore } from "react";
import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  type Announcements,
  type UniqueIdentifier,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Album, SharedWallState } from "@/types";
import { useGridDimensions } from "@/hooks/useGridDimensions";
import { useAlbumPinning } from "@/hooks/useAlbumPinning";
import { useAlbumSorting } from "@/hooks/useAlbumSorting";
import { useGridExport } from "@/hooks/useGridExport";
import { useAlbumShuffle } from "@/hooks/useAlbumShuffle";
import { swapAlbums } from "@/utils/dragAndDropHelpers";
import { buildSharedWallState, buildSharedWallUrl } from "@/utils/shareState";
import { saveWall } from "@/utils/savedWall";
import { EXPORT_PRESETS } from "@/utils/exportFrame";
import { GridControls } from "./GridControls";
import { GridDimensionsConfig } from "./GridDimensionsConfig";
import { ExportDropdown } from "./ExportDropdown";
import { WallDisplay } from "./WallDisplay";
import { PoolDisplay } from "./PoolDisplay";
import { AlbumDragPreview } from "../album/AlbumDragPreview";
import { AlbumActionSheet } from "../album/AlbumActionSheet";
import { Toast } from "../ui/Toast";

interface RecordGridProps {
  username: string;
  albums: Album[];
  onAlbumsReorder: (newAlbums: Album[]) => void;
  sharedWallState?: SharedWallState | null;
  canUndo?: boolean | undefined;
  onUndo?: (() => boolean) | undefined;
  onPinsChange?: (() => void) | undefined;
}

const DRAG_INSTRUCTIONS = {
  draggable:
    "To move an album, press space or enter to pick it up, use the arrow keys to reach another album, then press space or enter to swap places, or escape to cancel. Pinned albums cannot be moved.",
};

const WIDE_SCREEN_QUERY = "(min-width: 768px)";

function subscribeToWideScreen(onChange: () => void) {
  const query = window.matchMedia(WIDE_SCREEN_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getWideScreen() {
  return window.matchMedia(WIDE_SCREEN_QUERY).matches;
}

function getNoScreen() {
  return null;
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
  canUndo = false,
  onUndo,
  onPinsChange,
}: RecordGridProps) {
  // The label default follows the screen width until the user toggles it.
  const [labelsOverride, setLabelsOverride] = useState<boolean | null>(null);
  const wideScreen = useSyncExternalStore(subscribeToWideScreen, getWideScreen, getNoScreen);
  const showAlbumLabels = labelsOverride ?? wideScreen;
  const initialDimensions =
    sharedWallState && sharedWallState.username === username
      ? { rows: sharedWallState.rows, columns: sharedWallState.columns }
      : undefined;

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
    resetToDefault,
    toggleConfig,
    DEFAULT_ROWS,
    DEFAULT_COLUMNS,
  } = dimensions;
  const { pinnedAlbums, togglePinAlbum, togglePinAll, removePinsForAlbums, areAllPinned } = pinning;

  // The wall and the pool are the two parts of the one ordered list the parent owns, so they
  // follow the grid size and every reorder without any state of their own.
  const displayedAlbums = useMemo(() => albums.slice(0, gridSize), [albums, gridSize]);
  const poolItems = useMemo(() => albums.slice(gridSize), [albums, gridSize]);
  const [draggedAlbum, setDraggedAlbum] = useState<Album | null>(null);
  const exportButtonRef = useRef<HTMLButtonElement | null>(null);
  const exportMenuId = useId();
  const [sheetAlbum, setSheetAlbum] = useState<Album | null>(null);
  const [movingAlbum, setMovingAlbum] = useState<Album | null>(null);
  const [moveMessage, setMoveMessage] = useState<string | null>(null);

  /**
   * Applies the selected sort mode to the grid and pool while preserving pinned positions.
   *
   * @param option Sort mode selected from the control bar.
   */
  const handleSortChange = (option: typeof sorting.sortOption) => {
    sorting.handleSortChange(option);
    if (option === "none") return;

    onAlbumsReorder([
      ...sorting.sortAlbums(displayedAlbums, pinnedAlbums),
      ...sorting.sortAlbums(poolItems, pinnedAlbums),
    ]);
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

    onAlbumsReorder([...newDisplayedAlbums, ...newPoolItems]);
  };

  /**
   * Updates the wall dimensions through the grid-dimension hook.
   *
   * @param newRows Desired number of grid rows.
   * @param newColumns Desired number of grid columns.
   */
  const handleDimensionsChange = (newRows: number, newColumns: number) => {
    if (newRows < 1 || newColumns < 1) return;
    unpinAlbumsBeyond(newRows * newColumns);
    updateGridDimensions(newRows, newColumns);
  };

  /**
   * Restores the default wall size.
   */
  const handleResetDimensions = () => {
    unpinAlbumsBeyond(DEFAULT_ROWS * DEFAULT_COLUMNS);
    resetToDefault();
  };

  /**
   * Unpins the albums that a smaller wall pushes back into the pool.
   *
   * @param newSize Number of albums the wall will hold.
   */
  const unpinAlbumsBeyond = (newSize: number) => {
    if (newSize < displayedAlbums.length) {
      removePinsForAlbums(displayedAlbums.slice(newSize).map((album) => String(album.id)));
    }
  };

  /**
   * Toggles album-label visibility across the wall and pool displays.
   */
  const handleToggleAlbumLabels = () => {
    setLabelsOverride(!(showAlbumLabels ?? false));
  };

  /**
   * Handles a tap on a tile: finishes a pending move by swapping with the tapped album,
   * otherwise opens the tapped album's action sheet.
   *
   * @param album Album that was tapped.
   */
  const handleSelectAlbum = (album: Album) => {
    if (!movingAlbum) {
      setSheetAlbum(album);
      return;
    }
    if (album.id === movingAlbum.id) {
      setMovingAlbum(null);
      setMoveMessage(null);
      return;
    }

    const { newDisplayedAlbums, newPoolItems } = swapAlbums(
      displayedAlbums,
      poolItems,
      `album-${movingAlbum.id}`,
      `album-${album.id}`,
      pinnedAlbums
    );
    if (newDisplayedAlbums === displayedAlbums && newPoolItems === poolItems) {
      setMoveMessage("Pinned albums can't be swapped. Tap another album.");
      return;
    }

    onAlbumsReorder([...newDisplayedAlbums, ...newPoolItems]);
    setMovingAlbum(null);
    setMoveMessage(null);
  };

  // Drag and drop sensors
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: { distance: 8 },
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { distance: 4 },
  });

  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });

  const sensors = useSensors(mouseSensor, touchSensor, keyboardSensor);

  /**
   * Remembers the dragged album so the drag overlay can show its cover above both panels.
   *
   * @param event DnD Kit drag start event.
   */
  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    setDraggedAlbum(
      [...displayedAlbums, ...poolItems].find((album) => `album-${album.id}` === id) ?? null
    );
  }

  /**
   * Swaps the dragged album with the album it was dropped on; everything else stays in place.
   *
   * @param event DnD Kit drag end event.
   */
  function handleDragEnd(event: DragEndEvent) {
    setDraggedAlbum(null);
    const { active, over } = event;
    if (!over) return;

    const { newDisplayedAlbums, newPoolItems } = swapAlbums(
      displayedAlbums,
      poolItems,
      active.id,
      over.id,
      pinnedAlbums
    );
    if (newDisplayedAlbums === displayedAlbums && newPoolItems === poolItems) return;

    onAlbumsReorder([...newDisplayedAlbums, ...newPoolItems]);
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

  const currentWallAlbums = getSortedDisplayedAlbums();
  const currentWallState = buildSharedWallState({
    username,
    rows,
    columns,
    wallAlbumIds: currentWallAlbums.map((album) => String(album.id)),
    pinnedAlbumIds: Array.from(pinnedAlbums).filter((albumId) =>
      currentWallAlbums.some((album) => String(album.id) === albumId)
    ),
  });
  const currentWallSignature = JSON.stringify(currentWallState);

  // An older order could move an album that is now pinned, so a pin change resets undo.
  const pinSignature = Array.from(pinnedAlbums).sort().join(",");
  const previousPinSignature = useRef(pinSignature);
  useEffect(() => {
    if (previousPinSignature.current === pinSignature) return;
    previousPinSignature.current = pinSignature;
    onPinsChange?.();
  }, [pinSignature, onPinsChange]);

  // Remember the wall on this device so it comes back the next time this collection loads.
  useEffect(() => {
    if (!username) return;
    try {
      saveWall(window.localStorage, JSON.parse(currentWallSignature));
    } catch {
      // Storage is blocked; the wall just is not remembered.
    }
  }, [username, currentWallSignature]);

  /**
   * Copies a shareable hash URL for the current wall configuration to the clipboard.
   */
  const buildShareUrl = () => {
    if (typeof window === "undefined" || !username) return null;
    return buildSharedWallUrl(currentWallState, window.location.href);
  };

  /**
   * Puts back the album order from before the last change and returns to the custom order, so
   * the restored order is what shows.
   */
  const handleUndo = () => {
    if (!onUndo?.()) return;
    sorting.handleSortChange("none");
    setMovingAlbum(null);
    setMoveMessage(null);
    exportHooks.setStatus({ message: "Undid the last change.", tone: "info" });
  };

  // Ctrl+Z (Cmd+Z on a Mac) undoes too, unless the user is typing in a field.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "z" || !(event.ctrlKey || event.metaKey)) return;
      if (event.shiftKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      handleUndo();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  });

  /**
   * Copies the wall's share link to the clipboard.
   */
  const handleCopyShareLink = async () => {
    exportHooks.closeDropdown();
    const shareUrl = buildShareUrl();
    if (!shareUrl) {
      exportHooks.setStatus({ message: "Unable to build a share link yet.", tone: "error" });
      return;
    }

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

      exportHooks.setStatus({ message: "Share link copied.", tone: "info" });
    } catch (error) {
      console.error("Error copying share link:", error);
      exportHooks.setStatus({ message: "Unable to copy link.", tone: "error" });
    }
  };

  /**
   * Opens the device's share sheet with the wall's share link.
   */
  const handleShareLink = async () => {
    exportHooks.closeDropdown();
    const shareUrl = buildShareUrl();
    if (!shareUrl) {
      exportHooks.setStatus({ message: "Unable to build a share link yet.", tone: "error" });
      return;
    }

    try {
      await navigator.share({
        title: `${username}'s Vinyl Wall`,
        text: `Check out ${username}'s vinyl wall.`,
        url: shareUrl,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Error sharing link:", error);
      await handleCopyShareLink();
    }
  };

  /**
   * Describes where an album sits so drag announcements can name its slot: a wall slot is
   * numbered in the order shown, a pool position in the pool's order.
   *
   * @param id DnD Kit item identifier (`album-<id>`).
   * @returns The album and its place, or null when it is in neither list.
   */
  const describeAlbum = (id: UniqueIdentifier) => {
    const wall = getSortedDisplayedAlbums();
    const wallIndex = wall.findIndex((album) => `album-${album.id}` === id);
    if (wallIndex !== -1) {
      const album = wall[wallIndex]!;
      return {
        name: `${album.title || "Untitled"} by ${album.artist}`,
        place: `wall slot ${wallIndex + 1}`,
      };
    }
    const poolIndex = poolItems.findIndex((album) => `album-${album.id}` === id);
    if (poolIndex !== -1) {
      const album = poolItems[poolIndex]!;
      return {
        name: `${album.title || "Untitled"} by ${album.artist}`,
        place: `pool position ${poolIndex + 1}`,
      };
    }
    return null;
  };

  const dragAnnouncements: Announcements = {
    onDragStart({ active }) {
      const picked = describeAlbum(active.id);
      return picked ? `Picked up ${picked.name}, ${picked.place}.` : undefined;
    },
    onDragOver({ active, over }) {
      const picked = describeAlbum(active.id);
      const target = over ? describeAlbum(over.id) : null;
      // Picking an album up reports it over itself; stay quiet so "Picked up" is what is heard.
      if (!picked || over?.id === active.id) return undefined;
      return target
        ? `${picked.name} is over ${target.name}, ${target.place}.`
        : `${picked.name} is not over an album.`;
    },
    onDragEnd({ active, over }) {
      const picked = describeAlbum(active.id);
      const target = over ? describeAlbum(over.id) : null;
      if (!picked) return undefined;
      return target && over?.id !== active.id
        ? `Dropped ${picked.name} on ${target.name}. They swap places if neither is pinned.`
        : `Dropped ${picked.name}; it stays in ${picked.place}.`;
    },
    onDragCancel({ active }) {
      const picked = describeAlbum(active.id);
      return picked ? `Move cancelled. ${picked.name} stays in ${picked.place}.` : undefined;
    },
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Control Bar */}
      <div className="relative">
        <GridControls
          sortOption={sorting.sortOption}
          areAllPinned={areAllPinned(displayedAlbums)}
          showAlbumLabels={showAlbumLabels ?? false}
          onSortChange={handleSortChange}
          onToggleDimensionsConfig={toggleConfig}
          onTogglePinAll={() => togglePinAll(displayedAlbums)}
          onToggleAlbumLabels={handleToggleAlbumLabels}
          onShuffle={handleShuffle}
          canUndo={canUndo}
          onUndo={handleUndo}
          onToggleExportDropdown={exportHooks.toggleDropdown}
          exportOpen={exportHooks.dropdownOpen}
          exportMenuId={exportMenuId}
          exportButtonRef={exportButtonRef}
          showDimensionsConfig={showDimensionsConfig}
        />

        {/* Export Dropdown positioned absolutely */}
        <ExportDropdown
          isOpen={exportHooks.dropdownOpen}
          isExporting={exportHooks.isExporting}
          menuId={exportMenuId}
          triggerRef={exportButtonRef}
          onClose={exportHooks.closeDropdown}
          canShareLink={typeof navigator !== "undefined" && Boolean(navigator.share)}
          onShareOrSaveImage={() => void exportHooks.shareOrSaveImage()}
          presets={EXPORT_PRESETS}
          onExportPreset={(preset) => void exportHooks.shareOrSaveImage(preset)}
          onShareLink={handleShareLink}
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
          onReset={handleResetDimensions}
        />
      </div>

      <Toast toast={exportHooks.status} onDismiss={() => exportHooks.setStatus(null)} />

      {movingAlbum && (
        <div
          role="status"
          data-testid="move-banner"
          className="sticky top-2 z-40 flex items-center justify-between gap-3 rounded-control bg-accent-2 px-4 py-3 text-on-accent-2 shadow-sm"
        >
          <span>
            {moveMessage ?? `Moving ${movingAlbum.title || "album"}: tap another album to swap.`}
          </span>
          <button
            type="button"
            className="rounded-control bg-black/80 px-3 py-1 text-ink"
            onClick={() => {
              setMovingAlbum(null);
              setMoveMessage(null);
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {sheetAlbum && (
        <AlbumActionSheet
          album={sheetAlbum}
          isPinned={pinnedAlbums.has(String(sheetAlbum.id))}
          canPin={displayedAlbums.some((album) => album.id === sheetAlbum.id)}
          onClose={() => setSheetAlbum(null)}
          onTogglePin={() => {
            togglePinAlbum(String(sheetAlbum.id));
            setSheetAlbum(null);
          }}
          onMove={() => {
            setMovingAlbum(sheetAlbum);
            setMoveMessage(null);
            setSheetAlbum(null);
          }}
        />
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggedAlbum(null)}
        accessibility={{
          announcements: dragAnnouncements,
          screenReaderInstructions: DRAG_INSTRUCTIONS,
        }}
      >
        <div className="flex flex-col gap-8">
          {/* Wall Display */}
          <WallDisplay
            albums={currentWallAlbums}
            columns={columns}
            rows={rows}
            gridSize={gridSize}
            pinnedCount={pinnedAlbums.size}
            isExporting={exportHooks.isExporting}
            pinnedAlbums={pinnedAlbums}
            onPinToggle={togglePinAlbum}
            onSelect={handleSelectAlbum}
            moveSourceId={movingAlbum?.id ?? null}
            gridRef={exportHooks.gridRef}
            showAlbumLabels={showAlbumLabels}
          />

          {/* Pool Display */}
          <PoolDisplay
            albums={poolItems}
            onSelect={handleSelectAlbum}
            moveSourceId={movingAlbum?.id ?? null}
            showAlbumLabels={showAlbumLabels}
          />
        </div>

        {/* The dragged cover is drawn above both panels, so it stays visible between them. */}
        <DragOverlay>{draggedAlbum ? <AlbumDragPreview album={draggedAlbum} /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}
