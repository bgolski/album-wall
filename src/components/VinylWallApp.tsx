"use client";

import { useState, useTransition } from "react";
import { getUserCollection, validateDiscogsUsername } from "@/utils/discogs";
import { Album } from "@/types";
import { AppContainer } from "./AppContainer";
import { SearchInput } from "./SearchInput";
import { CollectionManager } from "./CollectionManager";

export default function VinylWallApp() {
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
    <AppContainer>
      <SearchInput
        username={username}
        isPending={isPending}
        usernameError={usernameError}
        error={error}
        onUsernameChange={handleUsernameChange}
        onLoadCollection={loadCollection}
      />

      <CollectionManager
        albums={albums}
        username={username}
        loadedUsername={loadedUsername}
        isPending={isPending}
        error={error}
        onAlbumsReorder={handleAlbumsReorder}
        onRetry={handleRetry}
      />
    </AppContainer>
  );
}
