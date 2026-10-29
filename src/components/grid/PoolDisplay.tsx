import { useState } from "react";
import { SortableContext, rectSwappingStrategy } from "@dnd-kit/sortable";
import { SortableRecord } from "../album/SortableRecord";
import { Album } from "@/types";
import { filterAlbums } from "@/utils/filterAlbums";
import { dragId } from "@/utils/albumKey";
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
    <div className="rounded-panel bg-panel p-4 shadow-sm 3xl:sticky 3xl:top-4 3xl:max-h-[calc(100vh-2rem)] 3xl:overflow-y-auto">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex flex-wrap items-baseline gap-x-2 text-lg font-bold text-ink sm:text-xl">
          <span>Not on the wall</span>
          <span aria-live="polite" className="text-base font-normal text-muted">
            {isFiltering ? `${visibleAlbums.length} of ${albums.length}` : albums.length} albums
          </span>
        </h2>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
          <PoolSearch query={query} onQueryChange={setQuery} className="w-full sm:w-64 lg:w-72" />
        </div>
      </div>
      {visibleAlbums.length === 0 && (
        <p className="py-6 text-center text-muted">No albums match &ldquo;{query.trim()}&rdquo;.</p>
      )}
      <div className="grid grid-cols-4 gap-2 sm:gap-3 md:grid-cols-6 md:gap-4 lg:grid-cols-8 3xl:grid-cols-6">
        <SortableContext
          items={visibleAlbums.map((album) => dragId(album))}
          strategy={rectSwappingStrategy}
        >
          {visibleAlbums.map((album) => (
            <SortableRecord
              key={`pool-${album.id}`}
              album={album}
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
