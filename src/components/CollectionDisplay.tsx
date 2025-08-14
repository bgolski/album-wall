import { Album } from "@/types";
import { RecordGrid } from "@/components/RecordGrid";

interface CollectionDisplayProps {
  albums: Album[];
  username: string;
  onAlbumsReorder: (newAlbums: Album[]) => void;
}

const UserHeader = ({ username, albumCount }: { username: string; albumCount: number }) => (
  <div className="mb-6 text-center">
    <div className="inline-flex items-center px-4 py-2 bg-gray-800 rounded-lg">
      <a
        href={`https://www.discogs.com/user/${username}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center text-blue-400 hover:text-blue-300 transition-colors"
      >
        <span className="mr-2">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.383 0 0 5.383 0 12s5.383 12 12 12 12-5.383 12-12S18.617 0 12 0zm0 4.5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15zm0 3a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm0 1.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />
          </svg>
        </span>
        <span className="font-medium">{username}</span>
      </a>
      <span className="mx-2 text-gray-400">•</span>
      <span className="text-gray-300">{albumCount} vinyl records</span>
    </div>
  </div>
);

export function CollectionDisplay({ albums, username, onAlbumsReorder }: CollectionDisplayProps) {
  return (
    <>
      <UserHeader username={username} albumCount={albums.length} />
      <RecordGrid albums={albums} username={username} onAlbumsReorder={onAlbumsReorder} />
    </>
  );
}
