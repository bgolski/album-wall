import { Album, SharedWallState } from "@/types";
import { CollectionLoader } from "./CollectionLoader";
import { ErrorMessage } from "../ui/ErrorMessage";
import { CollectionDisplay } from "./CollectionDisplay";
import { EmptyCollection } from "./EmptyCollection";

interface CollectionManagerProps {
  albums: Album[];
  username: string;
  loadedUsername: string;
  loadCount: number;
  sharedWallState: SharedWallState | null;
  isPending: boolean;
  error: string | null;
  onAlbumsReorder: (newAlbums: Album[]) => void;
  canUndo: boolean;
  onUndo: () => boolean;
  onRetry: () => void;
}

/**
 * Switches between the error, loading, and loaded collection states.
 */
export function CollectionManager({
  albums,
  username,
  loadedUsername,
  loadCount,
  sharedWallState,
  isPending,
  error,
  onAlbumsReorder,
  canUndo,
  onUndo,
  onRetry,
}: CollectionManagerProps) {
  return (
    <>
      {/* Error state */}
      {error && !isPending && <ErrorMessage error={error} username={username} onRetry={onRetry} />}

      {/* Loading and content states */}
      {!error &&
        (isPending ? (
          <CollectionLoader username={username} />
        ) : albums.length > 0 ? (
          <CollectionDisplay
            key={loadCount}
            albums={albums}
            username={loadedUsername}
            sharedWallState={sharedWallState}
            onAlbumsReorder={onAlbumsReorder}
            canUndo={canUndo}
            onUndo={onUndo}
          />
        ) : loadedUsername ? (
          <EmptyCollection username={loadedUsername} />
        ) : null)}
    </>
  );
}
