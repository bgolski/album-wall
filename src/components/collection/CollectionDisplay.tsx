import { DEMO_COLLECTION_LABEL } from "@/data/demoCollection";
import { Album, SharedWallState } from "@/types";
import { RecordGrid } from "../grid/RecordGrid";

interface CollectionDisplayProps {
  albums: Album[];
  username: string;
  isDemoCollection: boolean;
  sharedWallState: SharedWallState | null;
  onAlbumsReorder: (newAlbums: Album[]) => void;
}

/**
 * Displays the loaded collection summary and the interactive record grid.
 */
const UserHeader = ({
  username,
  albumCount,
  isDemoCollection,
}: {
  username: string;
  albumCount: number;
  isDemoCollection: boolean;
}) => (
  <div className="mb-6 text-center">
    <div className="inline-flex items-center rounded-lg bg-gray-800 px-4 py-2">
      {isDemoCollection ? (
        <span className="flex items-center text-emerald-300">
          <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/15 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
            D
          </span>
          <span className="font-medium">{DEMO_COLLECTION_LABEL}</span>
        </span>
      ) : (
        <a
          href={`https://www.discogs.com/user/${username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center text-blue-400 transition-colors hover:text-blue-300"
        >
          <span className="mr-2">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.383 0 0 5.383 0 12s5.383 12 12 12 12-5.383 12-12S18.617 0 12 0zm0 4.5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15zm0 3a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm0 1.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />
            </svg>
          </span>
          <span className="font-medium">{username}</span>
        </a>
      )}
      <span className="mx-2 text-gray-400">•</span>
      <span className="text-gray-300">{albumCount} vinyl records</span>
    </div>
  </div>
);

/**
 * Renders the loaded collection header and the wall/pool grid interface.
 */
export function CollectionDisplay({
  albums,
  username,
  isDemoCollection,
  sharedWallState,
  onAlbumsReorder,
}: CollectionDisplayProps) {
  return (
    <>
      <UserHeader
        username={username}
        albumCount={albums.length}
        isDemoCollection={isDemoCollection}
      />
      <RecordGrid
        albums={albums}
        username={username}
        sharedWallState={sharedWallState}
        onAlbumsReorder={onAlbumsReorder}
      />
    </>
  );
}
