"use client";

import { useState } from "react";
import { getUserCollection } from "@/utils/discogs";
import { RecordGrid } from "@/components/RecordGrid";
import { Album } from "@/types";

export default function Home() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadedUsername, setLoadedUsername] = useState("");

  async function loadCollection() {
    if (!username) return;

    setLoading(true);
    const collection = await getUserCollection(username);
    setAlbums(collection);
    setLoadedUsername(username);
    setLoading(false);
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      loadCollection();
    }
  };

  return (
    <main className="min-h-screen p-8 bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold mb-8">Record Wall Visualizer</h1>
          <div className="flex flex-wrap gap-3 items-center justify-center max-w-md mx-auto">
            <div className="relative w-full">
              <div className="relative flex items-center">
                <div className="absolute left-3.5 flex items-center pointer-events-none z-10">
                  <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                      clipRule="evenodd"
                    ></path>
                  </svg>
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter Discogs username"
                  className="w-full pl-10 pr-8 py-2.5 bg-gray-800 border border-gray-700 rounded-full text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
                {username && (
                  <button
                    onClick={() => setUsername("")}
                    type="button"
                    aria-label="Clear search"
                    className="absolute right-3 flex items-center justify-center text-gray-400 hover:text-gray-300"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      ></path>
                    </svg>
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2 text-left ml-4">
                Enter your Discogs username to load your vinyl collection
              </p>
            </div>
            <button
              onClick={loadCollection}
              disabled={loading}
              className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-lg"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
                </span>
              ) : (
                "Load Collection"
              )}
            </button>
          </div>
        </div>

        {albums.length > 0 && (
          <>
            <div className="mb-6 text-center">
              <div className="inline-flex items-center px-4 py-2 bg-gray-800 rounded-lg">
                <a
                  href={`https://www.discogs.com/user/${loadedUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <span className="mr-2">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.383 0 0 5.383 0 12s5.383 12 12 12 12-5.383 12-12S18.617 0 12 0zm0 4.5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15zm0 3a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm0 1.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />
                    </svg>
                  </span>
                  <span className="font-medium">{loadedUsername}</span>
                </a>
                <span className="mx-2 text-gray-400">•</span>
                <span className="text-gray-300">{albums.length} vinyl records</span>
              </div>
            </div>
            <RecordGrid albums={albums} />
          </>
        )}
      </div>
    </main>
  );
}
