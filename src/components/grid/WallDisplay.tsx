import { SortableContext, rectSwappingStrategy } from "@dnd-kit/sortable";
import { wallSize } from "@/utils/wallSize";
import { SortableRecord } from "../album/SortableRecord";
import { Album } from "@/types";
import { albumKey, dragId } from "@/utils/albumKey";
import { TILE_COVER_SIZE } from "@/utils/imageProxy";

interface WallDisplayProps {
  albums: Album[];
  columns: number;
  rows: number;
  gridSize: number;
  pinnedCount: number;
  pinnedAlbums: Set<string>;
  onPinToggle: (albumId: string) => void;
  onSelect: (album: Album) => void;
  moveSourceId: number | null;
  gridRef: React.RefObject<HTMLDivElement | null>;
  showAlbumLabels: boolean | null;
}

/**
 * Renders the active wall grid, including pin controls and the export target container.
 */
export function WallDisplay({
  albums,
  columns,
  rows,
  gridSize,
  pinnedCount,
  pinnedAlbums,
  onPinToggle,
  onSelect,
  moveSourceId,
  gridRef,
  showAlbumLabels,
}: WallDisplayProps) {
  return (
    <div className="rounded-panel bg-panel p-3 shadow-sm sm:p-4">
      <h2 className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-lg font-bold text-ink sm:mb-4 sm:text-xl">
        <span>Your wall</span>
        <span className="text-base font-normal text-muted">
          {wallSize(columns, rows)} · {gridSize} albums
          {pinnedCount > 0 && <span className="text-accent"> · {pinnedCount} pinned</span>}
        </span>
      </h2>
      <div
        ref={gridRef}
        id="grid-container"
        className="grid gap-3 sm:gap-4"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, auto)`,
        }}
      >
        <SortableContext
          items={albums.map((album) => dragId(album))}
          strategy={rectSwappingStrategy}
        >
          {albums.map((album) => (
            <SortableRecord
              key={`grid-${album.id}`}
              album={album}
              {...(columns >= 4 ? { imageSize: TILE_COVER_SIZE } : {})}
              isPinned={pinnedAlbums.has(albumKey(album))}
              onPinToggle={onPinToggle}
              onSelect={onSelect}
              isMoveSource={moveSourceId === album.id}
              showAlbumLabels={showAlbumLabels}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
