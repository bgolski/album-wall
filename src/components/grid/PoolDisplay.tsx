import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { SortableRecord } from "../album/SortableRecord";
import { Album } from "@/types";

interface PoolDisplayProps {
  albums: Album[];
}

export function PoolDisplay({ albums }: PoolDisplayProps) {
  if (albums.length === 0) return null;

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4 text-white">
        Remaining Record Pool ({albums.length} albums)
      </h2>
      <div className="grid grid-cols-8 gap-4">
        <SortableContext
          items={albums.map((album) => `album-${album.id}`)}
          strategy={rectSortingStrategy}
        >
          {albums.map((album) => (
            <SortableRecord
              key={`pool-${album.id}`}
              album={album}
              exportMode={false}
              isPinned={false}
              disablePinning={true}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
