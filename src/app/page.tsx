"use client";

import { useState } from "react";
import { getUserCollection } from "@/utils/discogs";
import { RecordGrid } from "@/components/RecordGrid";
import { Album } from "../types/index";

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
            />
            <button
              onClick={loadCollection}
              disabled={loading || !username}
              className="px-4 py-2 rounded-r bg-blue-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Loading..." : "Load Collection"}
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
            <RecordGrid
              albums={albums}
              username={loadedUsername}
              onAlbumsReorder={handleAlbumsReorder}
              loading={loading}
            />
          </>
        )}
      </div>
    </main>
  );
}
