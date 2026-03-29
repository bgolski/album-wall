import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { SortableRecord } from "../album/SortableRecord";
import { Album } from "@/types";

interface WallDisplayProps {
  albums: Album[];
  columns: number;
  rows: number;
  gridSize: number;
  pinnedCount: number;
  isExporting: boolean;
  pinnedAlbums: Set<string>;
  onPinToggle: (albumId: string) => void;
  gridRef: React.RefObject<HTMLDivElement | null>;
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
  isExporting,
  pinnedAlbums,
  onPinToggle,
  gridRef,
}: WallDisplayProps) {
  return (
    <div className="rounded-lg bg-gray-800 p-3 shadow sm:p-4">
      <h2 className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-lg font-bold text-white sm:mb-4 sm:text-xl">
        <span>Wall Display</span>
        <span className="text-gray-200">
          ({columns}×{rows} = {gridSize} albums)
        </span>
        {pinnedCount > 0 && (
          <span className="text-sm font-normal text-blue-300">({pinnedCount} pinned)</span>
        )}
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
          items={albums.map((album) => `album-${album.id}`)}
          strategy={rectSortingStrategy}
        >
          {albums.map((album) => (
            <SortableRecord
              key={`grid-${album.id}`}
              album={album}
              exportMode={isExporting}
              isPinned={pinnedAlbums.has(String(album.id))}
              onPinToggle={onPinToggle}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
