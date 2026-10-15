import { useState } from "react";
import { SortableContext, rectSwappingStrategy } from "@dnd-kit/sortable";
import { SortableRecord } from "../album/SortableRecord";
import { Album } from "@/types";
import { filterAlbums } from "@/utils/filterAlbums";
import { orderByRest } from "@/utils/hangHistory";
import { TILE_COVER_SIZE } from "@/utils/imageProxy";
import { PoolSearch } from "./PoolSearch";

interface PoolDisplayProps {
  albums: Album[];
  onSelect: (album: Album) => void;
  moveSourceId: number | null;
  showAlbumLabels: boolean | null;
  /** When each album was last on a wall the user hung, if there is any history. */
  lastHung?: ReadonlyMap<string, string> | undefined;
}

/**
 * Renders albums that do not currently fit in the wall grid and can be dragged back into it.
 */
export function PoolDisplay({
  albums,
  onSelect,
  moveSourceId,
  showAlbumLabels,
  lastHung,
}: PoolDisplayProps) {
  const [query, setQuery] = useState("");
  const [restedFirst, setRestedFirst] = useState(false);
  const hasHistory = Boolean(lastHung && lastHung.size > 0);

  if (albums.length === 0) return null;

  // Showing records that have rested longest first changes only how the pool is listed.
  const listed = restedFirst && hasHistory && lastHung ? orderByRest(albums, lastHung) : albums;
  const visibleAlbums = filterAlbums(listed, query);
  const isFiltering = visibleAlbums !== listed;

  return (
    <div className="rounded-panel bg-panel p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex flex-wrap items-baseline gap-x-2 text-lg font-bold text-ink sm:text-xl">
          <span>Not on the wall</span>
          <span aria-live="polite" className="text-base font-normal text-muted">
            {isFiltering ? `${visibleAlbums.length} of ${albums.length}` : albums.length} albums
          </span>
        </h2>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
          {hasHistory && (
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                role="switch"
                checked={restedFirst}
                onChange={(event) => setRestedFirst(event.target.checked)}
                className="h-4 w-4 accent-accent"
              />
              Not hung recently first
            </label>
          )}
          <PoolSearch query={query} onQueryChange={setQuery} className="w-full sm:w-64 lg:w-72" />
        </div>
      </div>
      {visibleAlbums.length === 0 && (
        <p className="py-6 text-center text-muted">No albums match &ldquo;{query.trim()}&rdquo;.</p>
      )}
      <div className="grid grid-cols-4 gap-2 sm:gap-3 md:grid-cols-6 md:gap-4 lg:grid-cols-8">
        <SortableContext
          items={visibleAlbums.map((album) => `album-${album.id}`)}
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
