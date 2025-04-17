"use client";

import { useState, useTransition, Suspense } from "react";
import { getUserCollection } from "@/utils/discogs";
import { RecordGrid } from "@/components/RecordGrid";
import { Album } from "../types/index";

// Loading component for the Suspense fallback
const CollectionLoader = ({ username }: { username: string }) => (
  <div className="mb-10 flex flex-col items-center justify-center py-12 px-4">
    <div className="animate-spin rounded-full h-20 w-20 border-t-2 border-b-2 border-blue-500 mb-4"></div>
    <p className="text-lg text-gray-300">Loading {username}&apos;s collection...</p>
    <p className="text-sm text-gray-400 mt-2">
      This may take a moment depending on collection size
    </p>
  </div>
);

// Collection display component
const CollectionDisplay = ({
  albums,
  username,
  onAlbumsReorder,
}: {
  albums: Album[];
  username: string;
  onAlbumsReorder: (newAlbums: Album[]) => void;
}) => (
  <>
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
        <span className="text-gray-300">{albums.length} vinyl records</span>
      </div>
    </div>
    <RecordGrid albums={albums} username={username} onAlbumsReorder={onAlbumsReorder} />
  </>
);

export default function Home() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [username, setUsername] = useState("");
  const [loadedUsername, setLoadedUsername] = useState("");
  const [isPending, startTransition] = useTransition();

  async function loadCollection() {
    if (!username) return;

    // Start a transition to show loading state
    startTransition(async () => {
      const collection = await getUserCollection(username);
      setAlbums(collection);
      setLoadedUsername(username);
    });
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      loadCollection();
    }
  };

  const handleAlbumsReorder = (newAlbums: Album[]) => {
    setAlbums(newAlbums);
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 bg-gray-900 text-white">
      <div className="w-full max-w-6xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-4">Vinyl Wall</h1>
          <p className="mb-6">
            Enter your Discogs username to load your vinyl collection and create a virtual record
            wall.
          </p>

          <div className="flex justify-center items-center gap-2 max-w-sm mx-auto">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Your Discogs username"
              className="flex-1 px-4 py-2 rounded-l bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
              disabled={isPending}
            />
            <button
              onClick={loadCollection}
              disabled={isPending || !username}
              className="px-4 py-2 rounded-r bg-blue-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
            >
              {isPending ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Loading...
                </>
              ) : (
                "Load Collection"
              )}
            </button>
          </div>
        </div>

        {/* Use Suspense for loading state */}
        {isPending ? (
          <Suspense fallback={<CollectionLoader username={username} />}>
            <CollectionLoader username={username} />
          </Suspense>
        ) : albums.length > 0 ? (
          <CollectionDisplay
            albums={albums}
            username={loadedUsername}
            onAlbumsReorder={handleAlbumsReorder}
          />
        ) : null}
      </div>
    </main>
  );
}
