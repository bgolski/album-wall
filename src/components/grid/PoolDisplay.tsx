import { useState } from "react";
import { SortableContext, rectSwappingStrategy } from "@dnd-kit/sortable";
import { SortableRecord } from "../album/SortableRecord";
import { Album } from "@/types";
import { filterAlbums } from "@/utils/filterAlbums";
import { TILE_COVER_SIZE } from "@/utils/imageProxy";
import { PoolSearch } from "./PoolSearch";

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
  const [query, setQuery] = useState("");

  if (albums.length === 0) return null;

  const visibleAlbums = filterAlbums(albums, query);
  const isFiltering = visibleAlbums !== albums;

  return (
    <div className="rounded-panel bg-panel p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-ink">
          Remaining Records (
          <span aria-live="polite">
            {isFiltering ? `${visibleAlbums.length} of ${albums.length}` : albums.length} albums
          </span>
          )
        </h2>
        <PoolSearch
          query={query}
          onQueryChange={setQuery}
          className="w-full sm:w-1/3 sm:min-w-[14rem] lg:w-1/4"
        />
      </div>
      {visibleAlbums.length === 0 && (
        <p className="py-6 text-center text-muted">No albums match &ldquo;{query.trim()}&rdquo;.</p>
      )}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 md:gap-4 lg:grid-cols-8">
        <SortableContext
          items={visibleAlbums.map((album) => `album-${album.id}`)}
          strategy={rectSwappingStrategy}
        >
          {visibleAlbums.map((album) => (
            <SortableRecord
              key={`pool-${album.id}`}
              album={album}
              exportMode={false}
              imageSize={TILE_COVER_SIZE}
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
