"use client";

import { useState } from "react";
import { getUserCollection } from "@/utils/discogs";
import { RecordGrid } from "@/components/RecordGrid";
import { Album } from "@/types";

export default function Home() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadCollection() {
    if (!username) return;

    setLoading(true);
    const collection = await getUserCollection(username);
    setAlbums(collection);
    setLoading(false);
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">Record Wall Visualizer</h1>
          <div className="flex flex-wrap gap-4 items-center">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter Discogs username"
              className="px-4 py-2 border rounded"
            />
            <button
              onClick={loadCollection}
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Load Collection"}
            </button>
          </div>
        </div>

        {albums.length > 0 && <RecordGrid albums={albums} />}
      </div>
    </main>
  );
}
