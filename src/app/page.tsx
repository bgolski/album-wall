"use client";

import { useState, useTransition, Suspense } from "react";
import { getUserCollection, validateDiscogsUsername } from "@/utils/discogs";
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

// Error component for displaying API errors
const ErrorMessage = ({
  error,
  username,
  onRetry,
}: {
  error: string;
  username: string;
  onRetry: () => void;
}) => (
  <div className="mb-10 flex flex-col items-center justify-center py-12 px-6 bg-gray-800 rounded-lg">
    <svg
      className="w-16 h-16 text-red-500 mb-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
    <h3 className="text-xl font-bold text-white mb-2">Error Loading Collection</h3>
    <p className="text-gray-300 mb-4 text-center">{error}</p>
    <p className="text-gray-400 mb-6 text-center text-sm">
      {username
        ? `We couldn't find "${username}" on Discogs or encountered a problem loading their collection.`
        : "There was a problem with the Discogs API."}
    </p>
    <div className="flex flex-wrap justify-center gap-3">
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
      >
        Try Again
      </button>
      <a
        href="https://www.discogs.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
      >
        Visit Discogs
      </a>
    </div>
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
  const [error, setError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  async function loadCollection() {
    if (!username) return;

    // Validate username format
    if (!validateDiscogsUsername(username)) {
      setUsernameError(
        "Invalid username format. Use only letters, numbers, dots, underscores, or hyphens."
      );
      return;
    }

    // Reset any errors
    setError(null);
    setUsernameError(null);

    // Start a transition to show loading state
    startTransition(async () => {
      try {
        const collection = await getUserCollection(username);
        setAlbums(collection);
        setLoadedUsername(username);
      } catch (err) {
        console.error("Error loading collection:", err);

        if (err instanceof Error) {
          // The getUserCollection function now throws specific error messages
          // that we can display directly to the user
          setError(err.message);
        } else {
          setError("An unexpected error occurred. Please try again.");
        }
      }
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

  const handleRetry = () => {
    loadCollection();
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

          <div className="flex flex-col items-center">
            <div className="flex justify-center items-center gap-2 max-w-sm w-full mx-auto">
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  // Clear errors when user starts typing a new username
                  if (error) setError(null);
                  if (usernameError) setUsernameError(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Your Discogs username"
                className={`flex-1 px-4 py-2 rounded-l bg-gray-800 border text-white focus:outline-none focus:border-blue-500 ${
                  usernameError ? "border-red-500" : "border-gray-700"
                }`}
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

            {usernameError && <p className="text-red-400 text-sm mt-2 max-w-sm">{usernameError}</p>}
          </div>
        </div>

        {/* Error state */}
        {error && !isPending && (
          <ErrorMessage error={error} username={username} onRetry={handleRetry} />
        )}

        {/* Loading and content states */}
        {!error &&
          (isPending ? (
            <Suspense fallback={<CollectionLoader username={username} />}>
              <CollectionLoader username={username} />
            </Suspense>
          ) : albums.length > 0 ? (
            <CollectionDisplay
              albums={albums}
              username={loadedUsername}
              onAlbumsReorder={handleAlbumsReorder}
            />
          ) : null)}
      </div>
    </main>
  );
}
