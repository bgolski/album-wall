import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { getUserCollection, validateDiscogsUsername } from "@/utils/discogs";
import { Album, SharedWallState } from "@/types";
import { getSharedWallStateFromHash, orderAlbumsBySharedWall } from "@/utils/shareState";

const VALIDATION_ERROR_MESSAGE =
  "Invalid username format. Use only letters, numbers, dots, underscores, or hyphens.";
const GENERIC_ERROR_MESSAGE = "An unexpected error occurred. Please try again.";

function subscribeToNothing() {
  return () => {};
}

function getLocationHash() {
  return window.location.hash;
}

function getNoHash() {
  return "";
}

/**
 * Manages Discogs username input, collection loading state, and album ordering updates.
 *
 * @returns Collection state plus actions for loading, retrying, and reordering albums.
 */
export function useCollection() {
  const [albums, setAlbums] = useState<Album[]>([]);
  // What the user typed; until they type, the box shows the name from a share link, if any.
  const [typedUsername, setTypedUsername] = useState<string | null>(null);
  const hash = useSyncExternalStore(subscribeToNothing, getLocationHash, getNoHash);
  const linkedWallState = useMemo(() => getSharedWallStateFromHash(hash), [hash]);
  const username = typedUsername ?? linkedWallState?.username ?? "";
  const [loadedUsername, setLoadedUsername] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [sharedWallState, setSharedWallState] = useState<SharedWallState | null>(null);

  /**
   * Clears both collection-level and username validation errors.
   */
  const clearErrors = () => {
    setError(null);
    setUsernameError(null);
  };

  /**
   * Loads a Discogs collection for a specific username and optionally preserves shared wall state.
   *
   * @param usernameToLoad Username whose collection should be loaded.
   * @param nextSharedWallState Parsed shared wall state, if the load originated from a share link.
   */
  const loadCollectionForUsername = useCallback(
    async (usernameToLoad: string, nextSharedWallState: SharedWallState | null = null) => {
      if (!usernameToLoad.trim()) return;

      if (!validateDiscogsUsername(usernameToLoad)) {
        setUsernameError(VALIDATION_ERROR_MESSAGE);
        return;
      }

      clearErrors();
      setSharedWallState(nextSharedWallState);

      startTransition(async () => {
        try {
          const collection = await getUserCollection(usernameToLoad);
          setAlbums(
            nextSharedWallState && nextSharedWallState.username === usernameToLoad
              ? orderAlbumsBySharedWall(collection, nextSharedWallState)
              : collection
          );
          setLoadedUsername(usernameToLoad);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : GENERIC_ERROR_MESSAGE;
          setError(errorMessage);
        }
      });
    },
    [startTransition]
  );

  /**
   * Validates the current username and loads the user's Discogs collection.
   * Stores the last successfully loaded username for display after input changes.
   */
  const loadCollection = async () => {
    await loadCollectionForUsername(username);
  };

  /**
   * Updates the username input and clears visible errors once the user edits the field.
   *
   * @param value New username input value.
   */
  const handleUsernameChange = (value: string) => {
    setTypedUsername(value);
    if (sharedWallState && value !== sharedWallState.username) {
      setSharedWallState(null);
    }

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
  const handleAlbumsReorder = useCallback((newAlbums: Album[]) => {
    setAlbums(newAlbums);
  }, []);

  /**
   * Retries loading the currently entered Discogs collection.
   */
  const retry = () => {
    loadCollection();
  };

  // A share link in the address loads its collection once, when the page opens.
  const startedFromLink = useRef(false);
  useEffect(() => {
    if (!linkedWallState || startedFromLink.current) return;
    startedFromLink.current = true;
    void loadCollectionForUsername(linkedWallState.username, linkedWallState);
  }, [linkedWallState, loadCollectionForUsername]);

  return {
    // State
    albums,
    username,
    loadedUsername,
    sharedWallState,
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
