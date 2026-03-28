import { useState, useTransition } from "react";
import { getUserCollection, validateDiscogsUsername } from "@/utils/discogs";
import { Album } from "@/types";

const VALIDATION_ERROR_MESSAGE =
  "Invalid username format. Use only letters, numbers, dots, underscores, or hyphens.";
const GENERIC_ERROR_MESSAGE = "An unexpected error occurred. Please try again.";

/**
 * Manages Discogs username input, collection loading state, and album ordering updates.
 *
 * @returns Collection state plus actions for loading, retrying, and reordering albums.
 */
export function useCollection() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [username, setUsername] = useState("");
  const [loadedUsername, setLoadedUsername] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  /**
   * Clears both collection-level and username validation errors.
   */
  const clearErrors = () => {
    setError(null);
    setUsernameError(null);
  };

  /**
   * Validates the current username and loads the user's Discogs collection.
   * Stores the last successfully loaded username for display after input changes.
   */
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
        // Error already logged by discogs utility
        const errorMessage = err instanceof Error ? err.message : GENERIC_ERROR_MESSAGE;
        setError(errorMessage);
      }
    });
  };

  /**
   * Updates the username input and clears visible errors once the user edits the field.
   *
   * @param value New username input value.
   */
  const handleUsernameChange = (value: string) => {
    setUsername(value);
    // Clear errors when user starts typing
    if (error || usernameError) {
      clearErrors();
    }
  };

  /**
   * Replaces the current album order after grid or pool interactions.
   *
   * @param newAlbums Full album list in its new order.
   */
  const handleAlbumsReorder = (newAlbums: Album[]) => {
    setAlbums(newAlbums);
  };

  /**
   * Retries loading the currently entered Discogs collection.
   */
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
