"use client";

import { useState, useTransition, Suspense } from "react";
import { getUserCollection, validateDiscogsUsername } from "@/utils/discogs";
import { Album } from "@/types";
import { CollectionLoader } from "@/components/CollectionLoader";
import { ErrorMessage } from "@/components/ErrorMessage";
import { CollectionDisplay } from "@/components/CollectionDisplay";
import { SearchInput } from "@/components/SearchInput";

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

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    // Clear errors when user starts typing a new username
    if (error) setError(null);
    if (usernameError) setUsernameError(null);
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
        <SearchInput
          username={username}
          isPending={isPending}
          usernameError={usernameError}
          error={error}
          onUsernameChange={handleUsernameChange}
          onKeyDown={handleKeyDown}
          onLoadCollection={loadCollection}
        />

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
