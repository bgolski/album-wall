import { useEffect, useId, useMemo, useRef, useState } from "react";
import { DndContext, closestCenter, DragOverlay } from "@dnd-kit/core";
import { Album, SharedWallState } from "@/types";
import { useGridDimensions } from "@/hooks/useGridDimensions";
import { useAlbumPinning } from "@/hooks/useAlbumPinning";
import { useAlbumSorting } from "@/hooks/useAlbumSorting";
import { useGridExport } from "@/hooks/useGridExport";
import { useAlbumShuffle } from "@/hooks/useAlbumShuffle";
import { useAlbumLabels } from "@/hooks/useAlbumLabels";
import { useGradientBuilder } from "@/hooks/useGradientBuilder";
import { useMoveMode } from "@/hooks/useMoveMode";
import { useWallDrag, DRAG_INSTRUCTIONS } from "@/hooks/useWallDrag";
import { useRememberWall } from "@/hooks/useRememberWall";
import { useShareLinks } from "@/hooks/useShareLinks";
import { useUndoShortcut } from "@/hooks/useUndoShortcut";
import { useWallResize } from "@/hooks/useWallResize";
import { useHangHistory } from "@/hooks/useHangHistory";
import { usePressings } from "@/hooks/usePressings";
import { recentlyHungCost } from "@/utils/hangHistory";
import { buildSharedWallState, orderAlbumsBySharedWall } from "@/utils/shareState";
import { EXPORT_PRESETS } from "@/utils/exportFrame";
import { GridControls } from "./GridControls";
import { CoverSourceNotice } from "./CoverSourceNotice";
import { GridDimensionsConfig } from "./GridDimensionsConfig";
import { LayoutsPanel } from "../layouts/LayoutsPanel";
import { GradientPanel } from "../gradient/GradientPanel";
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

/**
 * Coordinates wall-grid interactions including sorting, pinning, shuffling, exporting,
 * dimension changes, and drag-and-drop between the wall and pool.
 */
export function RecordGrid({
  username,
  albums: collection,
  onAlbumsReorder: reorderCollection,
  sharedWallState,
  canUndo = false,
  onUndo,
  onPinsChange,
}: RecordGridProps) {
  const { showAlbumLabels, toggleAlbumLabels } = useAlbumLabels();
  // With "show each album once" on, extra pressings are set aside at the end of the collection;
  // everything below works on the albums shown, and a reorder keeps the ones set aside.
  const pressings = usePressings(username, collection);
  const albums = pressings.shown;
  const onAlbumsReorder = (next: Album[]) => reorderCollection(pressings.withHidden(next));
  const sharedHere = sharedWallState?.username === username ? sharedWallState : null;
  const dimensions = useGridDimensions(
    sharedHere ? { rows: sharedHere.rows, columns: sharedHere.columns } : undefined
  );
  const pinning = useAlbumPinning(sharedHere?.pinnedAlbumIds);
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
  const {
    pinnedAlbums,
    togglePinAlbum,
    togglePinAll,
    removePinsForAlbums,
    replacePinnedAlbums,
    areAllPinned,
  } = pinning;
  const [showLayouts, setShowLayouts] = useState(false);
  // A cover's color chosen to start a gradient wall from; a new choice starts the builder afresh.
  const [gradientStart, setGradientStart] = useState<{
    id: number;
    colors: string[];
    note: string;
  } | null>(null);
  const exportButtonRef = useRef<HTMLButtonElement | null>(null);
  const exportMenuId = useId();

  // The wall and the pool are the two parts of the one ordered list the parent owns, so they
  // follow the grid size and every reorder without any state of their own.
  const displayedAlbums = useMemo(() => albums.slice(0, gridSize), [albums, gridSize]);
  const poolItems = useMemo(() => albums.slice(gridSize), [albums, gridSize]);

  const colorSortActive = sorting.sortOption === "color";

  // Sorting by artist or genre is a view of the wall; Sort by Color changes it only when a
  // gradient wall is built.
  const wallAlbums =
    sorting.sortOption === "none" || colorSortActive
      ? displayedAlbums
      : sorting.sortAlbums(displayedAlbums, pinnedAlbums);

  // A change made by hand (drag, move, shuffle) applies to the wall as shown, and becomes the custom
  // order; otherwise the sort would put the wall straight back.
  const reorderByHand = (next: Album[]) => {
    if (sorting.sortOption === "artist" || sorting.sortOption === "genre") {
      sorting.handleSortChange("none");
    }
    onAlbumsReorder(next);
  };
  const history = useHangHistory(username);
  const restCost = useMemo(() => recentlyHungCost(history.hangs), [history.hangs]);
  const gradient = useGradientBuilder({
    restCost,
    albums,
    rows,
    columns,
    pinnedAlbums,
    onAlbumsReorder,
    active: colorSortActive,
  });
  const move = useMoveMode({
    displayedAlbums: wallAlbums,
    poolItems,
    pinnedAlbums,
    onAlbumsReorder: reorderByHand,
  });
  const resize = useWallResize({
    displayedAlbums,
    removePinsForAlbums,
    setSize: updateGridDimensions,
    resetSize: resetToDefault,
    defaultSize: DEFAULT_ROWS * DEFAULT_COLUMNS,
  });

  const wallState = buildSharedWallState({
    username,
    rows,
    columns,
    wallAlbumIds: wallAlbums.map((album) => String(album.id)),
    pinnedAlbumIds: Array.from(pinnedAlbums).filter((albumId) =>
      wallAlbums.some((album) => String(album.id) === albumId)
    ),
  });
  useRememberWall({ username, wall: wallState, pinnedAlbums, onPinsChange });

  const drag = useWallDrag({
    wallAlbums,
    displayedAlbums: wallAlbums,
    poolItems,
    pinnedAlbums,
    onAlbumsReorder: reorderByHand,
  });
  const share = useShareLinks({
    username,
    wall: wallState,
    covers: wallAlbums.map((album) => album.cover_image ?? album.coverUrl ?? ""),
    closeMenu: exportHooks.closeDropdown,
    setStatus: exportHooks.setStatus,
  });
  // Ask for the short link as the export menu opens, so it is ready when a share is chosen.
  const prepareShareLink = share.prepare;
  useEffect(() => {
    if (exportHooks.dropdownOpen) prepareShareLink();
    // Only the menu opening matters; the wall cannot change while the menu is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportHooks.dropdownOpen]);

  /**
   * Shows the wall in the chosen order.
   *
   * @param option Sort mode selected from the control bar.
   */
  const handleSortChange = (option: typeof sorting.sortOption) => {
    // Sorts are views of the wall (Custom Order returns to the user's own order), and Sort by Color
    // opens the gradient builder, so choosing one does not reorder the collection.
    sorting.handleSortChange(option);
  };

  /**
   * Randomizes only unpinned albums across the grid and pool, then syncs the new order upward.
   */
  const handleShuffle = () => {
    const { newDisplayedAlbums, newPoolItems } = shuffleUnpinnedAlbums(
      wallAlbums,
      poolItems,
      pinnedAlbums
    );
    reorderByHand([...newDisplayedAlbums, ...newPoolItems]);
  };

  /**
   * Puts a saved wall on the wall: its size, its pins and its albums, in order. Albums it names
   * that are no longer in the collection are skipped, and the next albums fill their places.
   *
   * @param wall Saved wall to show.
   */
  const applyWall = (wall: SharedWallState) => {
    sorting.handleSortChange("none");
    updateGridDimensions(wall.rows, wall.columns);
    replacePinnedAlbums(wall.pinnedAlbumIds);
    onAlbumsReorder(orderAlbumsBySharedWall(albums, wall));
  };

  /**
   * Puts back the album order from before the last change and returns to the custom order, so
   * the restored order is what shows.
   */
  const handleUndo = () => {
    if (!onUndo?.()) return;
    // A sort would reapply itself to the restored order; the gradient builder stays open so the
    // wall can be tried again.
    if (!colorSortActive) sorting.handleSortChange("none");
    move.cancelMove();
    exportHooks.setStatus({ message: "Undid the last change.", tone: "info" });
  };
  useUndoShortcut(handleUndo);

  const { sheetAlbum, movingAlbum } = move;

  return (
    <div className="flex flex-col gap-8">
      {/* Control Bar */}
      <div className="relative">
        <CoverSourceNotice />
        <GridControls
          sortOption={sorting.sortOption}
          areAllPinned={areAllPinned(displayedAlbums)}
          showAlbumLabels={showAlbumLabels ?? false}
          onSortChange={handleSortChange}
          onToggleDimensionsConfig={toggleConfig}
          onToggleLayouts={() => setShowLayouts((open) => !open)}
          showLayouts={showLayouts}
          onTogglePinAll={() => togglePinAll(displayedAlbums)}
          onToggleAlbumLabels={toggleAlbumLabels}
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
          onShareLink={share.shareLink}
          onCopyShareLink={share.copyShareLink}
        />

        <GridDimensionsConfig
          isVisible={showDimensionsConfig}
          rows={rows}
          columns={columns}
          gridSize={gridSize}
          defaultRows={DEFAULT_ROWS}
          defaultColumns={DEFAULT_COLUMNS}
          onDimensionsChange={resize.changeSize}
          pressings={pressings}
          onReset={resize.resetSize}
        />

        <LayoutsPanel
          isVisible={showLayouts}
          collectionName={username}
          currentWall={wallState}
          albums={albums}
          onApply={applyWall}
          history={history}
        />

        <GradientPanel
          key={gradientStart?.id ?? 0}
          start={gradientStart ?? undefined}
          isVisible={colorSortActive}
          rows={rows}
          columns={columns}
          pending={gradient.pending}
          total={gradient.total}
          onBuild={gradient.build}
          suggestions={gradient.suggestions}
          summary={gradient.summary}
          canPreferRested={history.hangs.length > 0}
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
            {move.moveMessage ??
              `Moving ${movingAlbum.title || "album"}: tap another album to swap.`}
          </span>
          <button
            type="button"
            className="rounded-control bg-black/80 px-3 py-1 text-ink"
            onClick={move.cancelMove}
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
          {...(colorSortActive && String(sheetAlbum.id) in gradient.profiles
            ? { colorProfile: gradient.profiles[String(sheetAlbum.id)] ?? null }
            : {})}
          {...(history.hangs.length > 0
            ? { lastHungOn: history.lastHung.get(String(sheetAlbum.id)) ?? null }
            : {})}
          {...(pressings.once && pressings.otherPressings(sheetAlbum).length > 0
            ? {
                otherPressings: pressings.otherPressings(sheetAlbum),
                onShowPressing: (album: Album) => {
                  pressings.choose(album);
                  move.closeSheet();
                },
              }
            : {})}
          {...(colorSortActive
            ? {
                onStartFromColor: (hex: string) => {
                  setGradientStart((previous) => ({
                    id: (previous?.id ?? 0) + 1,
                    colors: [hex, hex],
                    note: `Starting from a color on ${sheetAlbum.title || "this album"}. Choose Build wall.`,
                  }));
                  move.closeSheet();
                },
              }
            : {})}
          onClose={move.closeSheet}
          onTogglePin={() => {
            togglePinAlbum(String(sheetAlbum.id));
            move.closeSheet();
          }}
          onMove={() => move.startMove(sheetAlbum)}
        />
      )}

      <DndContext
        sensors={drag.sensors}
        collisionDetection={closestCenter}
        onDragStart={drag.onDragStart}
        onDragEnd={drag.onDragEnd}
        onDragCancel={drag.onDragCancel}
        accessibility={{
          announcements: drag.announcements,
          screenReaderInstructions: DRAG_INSTRUCTIONS,
        }}
      >
        <div className="flex flex-col gap-8">
          <WallDisplay
            albums={wallAlbums}
            columns={columns}
            rows={rows}
            gridSize={gridSize}
            pinnedCount={pinnedAlbums.size}
            pinnedAlbums={pinnedAlbums}
            onPinToggle={togglePinAlbum}
            onSelect={move.selectAlbum}
            moveSourceId={movingAlbum?.id ?? null}
            gridRef={exportHooks.gridRef}
            showAlbumLabels={showAlbumLabels}
          />

          <PoolDisplay
            albums={poolItems}
            onSelect={move.selectAlbum}
            moveSourceId={movingAlbum?.id ?? null}
            showAlbumLabels={showAlbumLabels}
            lastHung={history.lastHung}
          />
        </div>

        {/* The dragged cover is drawn above both panels, so it stays visible between them. */}
        <DragOverlay>
          {drag.draggedAlbum ? <AlbumDragPreview album={drag.draggedAlbum} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
