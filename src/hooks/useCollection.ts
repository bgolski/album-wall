import { useState, useTransition } from "react";
import { getUserCollection, validateDiscogsUsername } from "@/utils/discogs";
import { Album } from "@/types";

const VALIDATION_ERROR_MESSAGE =
  "Invalid username format. Use only letters, numbers, dots, underscores, or hyphens.";
const GENERIC_ERROR_MESSAGE = "An unexpected error occurred. Please try again.";

export function useCollection() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [username, setUsername] = useState("");
  const [loadedUsername, setLoadedUsername] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const clearErrors = () => {
    setError(null);
    setUsernameError(null);
  };

  const loadCollection = async () => {
    if (!username.trim()) return;

    // Validate username format
    if (!validateDiscogsUsername(username)) {
      setUsernameError(VALIDATION_ERROR_MESSAGE);
      return;
    }

    clearErrors();

    startTransition(async () => {
      try {
        const collection = await getUserCollection(username);
        setAlbums(collection);
        setLoadedUsername(username);
      } catch (err) {
        console.error("Error loading collection:", err);

        const errorMessage = err instanceof Error ? err.message : GENERIC_ERROR_MESSAGE;
        setError(errorMessage);
      }
    });
  };

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    // Clear errors when user starts typing
    if (error || usernameError) {
      clearErrors();
    }
  };

  const handleAlbumsReorder = (newAlbums: Album[]) => {
    setAlbums(newAlbums);
  };

  const retry = () => {
    loadCollection();
  };

  return {
    // State
    albums,
    username,
    loadedUsername,
    isPending,
    error,
    usernameError,
    // Actions
    loadCollection,
    handleUsernameChange,
    handleAlbumsReorder,
    retry,
  };
}
