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
import { loadLastUsername, loadSavedWall, saveLastUsername } from "@/utils/savedWall";
import { readCachedCollection, writeCachedCollection } from "@/utils/collectionCache";
import { useUndoHistory } from "@/hooks/useUndoHistory";

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

function getLastUsername() {
  const storage = getStorage("localStorage");
  return storage ? loadLastUsername(storage) : null;
}

function getNoUsername() {
  return null;
}

/**
 * Returns the named browser storage, or null where it is missing or blocked: some browsers throw
 * as soon as the property is read when site data is disabled.
 *
 * @param name Which storage to read.
 * @returns The storage, or null.
 */
function getStorage(name: "localStorage" | "sessionStorage"): Storage | null {
  try {
    return typeof window === "undefined" ? null : window[name];
  } catch {
    return null;
  }
}

/**
 * Manages Discogs username input, collection loading state, and album ordering updates.
 *
 * @returns Collection state plus actions for loading, retrying, reordering and undoing.
 */
export function useCollection() {
  const [albums, setAlbums] = useState<Album[]>([]);
  // What the user typed; until they type, the box shows the name from a share link, or the name
  // loaded last time on this device.
  const [typedUsername, setTypedUsername] = useState<string | null>(null);
  const hash = useSyncExternalStore(subscribeToNothing, getLocationHash, getNoHash);
  const lastUsername = useSyncExternalStore(subscribeToNothing, getLastUsername, getNoUsername);
  const linkedWallState = useMemo(() => getSharedWallStateFromHash(hash), [hash]);
  const username = typedUsername ?? linkedWallState?.username ?? lastUsername ?? "";
  const [loadedUsername, setLoadedUsername] = useState("");
  // Counts finished loads, so the wall starts afresh even when a load finishes without a
  // visible loading state (a cached collection).
  const [loadCount, setLoadCount] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [sharedWallState, setSharedWallState] = useState<SharedWallState | null>(null);
  const history = useUndoHistory<Album[]>();
  const { clear: clearHistory, record: recordHistory, undo: undoHistory } = history;

  /**
   * Clears both collection-level and username validation errors.
   */
  const clearErrors = () => {
    setError(null);
    setUsernameError(null);
  };

  /**
   * Loads a Discogs collection for a specific username. The wall comes from a share link when
   * there is one, otherwise from the wall saved on this device for that username.
   *
   * @param usernameToLoad Username whose collection should be loaded.
   * @param linkedState Parsed shared wall state, if the load originated from a share link.
   * @param fresh Skip the recently loaded copy and ask Discogs again.
   */
  const loadCollectionForUsername = useCallback(
    async (usernameToLoad: string, linkedState: SharedWallState | null = null, fresh = false) => {
      if (!usernameToLoad.trim()) return;

      if (!validateDiscogsUsername(usernameToLoad)) {
        setUsernameError(VALIDATION_ERROR_MESSAGE);
        return;
      }

      clearErrors();
      const localStore = getStorage("localStorage");
      const savedState = localStore ? loadSavedWall(localStore, usernameToLoad) : null;
      const wallState =
        linkedState ?? (savedState ? { ...savedState, username: usernameToLoad } : null);
      setSharedWallState(wallState);

      startTransition(async () => {
        try {
          const sessionStore = getStorage("sessionStorage");
          const cached =
            fresh || !sessionStore
              ? null
              : readCachedCollection(sessionStore, usernameToLoad, Date.now());
          const collection = cached ?? (await getUserCollection(usernameToLoad));
          if (!cached && sessionStore) {
            writeCachedCollection(sessionStore, usernameToLoad, collection, Date.now());
          }
          setAlbums(
            wallState && wallState.username === usernameToLoad
              ? orderAlbumsBySharedWall(collection, wallState)
              : collection
          );
          setLoadedUsername(usernameToLoad);
          setLoadCount((count) => count + 1);
          clearHistory();
          if (localStore) saveLastUsername(localStore, usernameToLoad);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : GENERIC_ERROR_MESSAGE;
          setError(errorMessage);
        }
      });
    },
    [startTransition, clearHistory]
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
   * Replaces the current album order after grid or pool interactions, remembering the previous
   * order so it can be undone.
   *
   * @param newAlbums Full album list in its new order.
   */
  const handleAlbumsReorder = useCallback(
    (newAlbums: Album[]) => {
      recordHistory(albums);
      setAlbums(newAlbums);
    },
    [albums, recordHistory]
  );

  /**
   * Puts back the album order from before the last reorder.
   *
   * @returns Whether there was a change to undo.
   */
  const undo = useCallback(() => {
    const previous = undoHistory();
    if (!previous) return false;
    setAlbums(previous);
    return true;
  }, [undoHistory]);

  /**
   * Forgets the undo history. Pinning changes which albums must stay put, and an older order
   * could move a pinned album, so undo starts again from the pins as they are now.
   */
  const forgetUndo = clearHistory;

  /**
   * Retries loading the currently entered Discogs collection, asking Discogs again.
   */
  const retry = () => {
    void loadCollectionForUsername(username, null, true);
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
    loadCount,
    sharedWallState,
    isPending,
    error,
    usernameError,
    canUndo: history.canUndo,
    // Actions
    loadCollection,
    handleUsernameChange,
    handleAlbumsReorder,
    undo,
    forgetUndo,
    retry,
  };
}
