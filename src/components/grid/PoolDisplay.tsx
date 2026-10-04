import { SortableContext, rectSwappingStrategy } from "@dnd-kit/sortable";
import { SortableRecord } from "../album/SortableRecord";
import { Album } from "@/types";

interface PoolDisplayProps {
  albums: Album[];
  onSelect: (album: Album) => void;
  moveSourceId: number | null;
  showAlbumLabels: boolean | null;
}

/**
 * Renders albums that do not currently fit in the wall grid and can be dragged back into it.
 */
export function PoolDisplay({ albums, onSelect, moveSourceId, showAlbumLabels }: PoolDisplayProps) {
  if (albums.length === 0) return null;

  return (
    <div className="rounded-lg bg-gray-800 p-4 shadow-sm">
      <h2 className="mb-4 text-xl font-bold text-white">
        Remaining Record Pool ({albums.length} albums)
      </h2>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 md:gap-4 lg:grid-cols-8">
        <SortableContext
          items={albums.map((album) => `album-${album.id}`)}
          strategy={rectSwappingStrategy}
        >
          {albums.map((album) => (
            <SortableRecord
              key={`pool-${album.id}`}
              album={album}
              exportMode={false}
              isPinned={false}
              disablePinning={true}
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
