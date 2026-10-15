import { Album, SharedWallState } from "@/types";
import { RecordGrid } from "../grid/RecordGrid";

interface CollectionDisplayProps {
  albums: Album[];
  username: string;
  sharedWallState: SharedWallState | null;
  onAlbumsReorder: (newAlbums: Album[]) => void;
  canUndo?: boolean | undefined;
  onUndo?: (() => boolean) | undefined;
  onPinsChange?: (() => void) | undefined;
}

/**
 * Renders the wall and pool for the loaded collection.
 */
export function CollectionDisplay({
  albums,
  username,
  sharedWallState,
  onAlbumsReorder,
  canUndo,
  onUndo,
  onPinsChange,
}: CollectionDisplayProps) {
  return (
    <RecordGrid
      albums={albums}
      username={username}
      sharedWallState={sharedWallState}
      onAlbumsReorder={onAlbumsReorder}
      canUndo={canUndo}
      onUndo={onUndo}
      onPinsChange={onPinsChange}
    />
  );
}
