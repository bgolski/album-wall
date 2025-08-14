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
    <div className="bg-gray-800 p-4 rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4 text-white">
        Wall Display ({columns}×{rows} = {gridSize} albums)
        {pinnedCount > 0 && (
          <span className="ml-2 text-blue-300 text-sm font-normal">({pinnedCount} pinned)</span>
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
