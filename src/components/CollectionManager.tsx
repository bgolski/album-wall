import React from "react";
import { Album } from "@/types";
import { CollectionLoader } from "./CollectionLoader";
import { ErrorMessage } from "./ErrorMessage";
import { CollectionDisplay } from "./CollectionDisplay";

interface CollectionManagerProps {
  albums: Album[];
  username: string;
  loadedUsername: string;
  isPending: boolean;
  error: string | null;
  onAlbumsReorder: (newAlbums: Album[]) => void;
  onRetry: () => void;
}

export const CollectionManager = ({
  albums,
  username,
  loadedUsername,
  isPending,
  error,
  onAlbumsReorder,
  onRetry,
}: CollectionManagerProps) => (
  <>
    {/* Error state */}
    {error && !isPending && <ErrorMessage error={error} username={username} onRetry={onRetry} />}

    {/* Loading and content states */}
    {!error &&
      (isPending ? (
        <CollectionLoader username={username} />
      ) : albums.length > 0 ? (
        <CollectionDisplay
          albums={albums}
          username={loadedUsername}
          onAlbumsReorder={onAlbumsReorder}
        />
      ) : null)}
  </>
);
