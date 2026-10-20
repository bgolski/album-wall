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
import { DEMO_USERNAME, parseDemoCollection } from "@/utils/demoCollection";
import { getBasePath } from "@/utils/basePath";
import { setAddressUser, userFromAddress } from "@/utils/loadAddress";
import { DiscogsSession, proxyErrorCode } from "@/utils/discogsSignIn";

const VALIDATION_ERROR_MESSAGE =
  "Invalid username format. Use only letters, numbers, dots, underscores, or hyphens.";
const DEMO_MISSING_MESSAGE = "The demo wall is not available right now.";
const GENERIC_ERROR_MESSAGE = "An unexpected error occurred. Please try again.";
const PRIVATE_SHARED_WALL_MESSAGE =
  "This wall was shared from a private Discogs collection, so only its owner can open it here. If it is yours, sign in with Discogs. Otherwise ask them for a saved image of the wall, or to make their collection public on Discogs.";
const SIGNED_OUT_MESSAGE =
  "Your Discogs sign-in has ended, so you have been signed out. Sign in again to load this collection.";
const FOLDER_KEY_PREFIX = "album-wall:folder:";

/** Why a load failed, when the app can say more than the message. */
export type CollectionErrorKind =
  "private" | "private-shared" | "signed-out" | "not-found" | "busy" | "unavailable" | null;

/**
 * Sorts a failed load by what the visitor can do about it.
 *
 * @param error What the load threw.
 * @returns The kind, or null when it is something else.
 */
export function collectionErrorKind(error: unknown): CollectionErrorKind {
  const code = proxyErrorCode(error);
  if (code === "private") return "private";
  if (code === "signed-out") return "signed-out";
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status !== "number") return null;
  if (status === 404) return "not-found";
  if (status === 429) return "busy";
  // No answer at all (status 0), a timeout or a server error: worth trying again later.
  if (status === 0 || status === 408 || status >= 500) return "unavailable";
  return null;
}

function subscribeToNothing() {
  return () => {};
}

function getLocationHash() {
  return window.location.hash;
}

function getNoHash() {
  return "";
}

function getLocationSearch() {
  return window.location.search;
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

function sameName(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * The folder the signed-in visitor chose last time on this device.
 *
 * @param username The signed-in visitor.
 * @returns The folder id, 0 (the whole collection) when none was chosen.
 */
function loadFolderChoice(username: string): number {
  try {
    const value = Number(getStorage("localStorage")?.getItem(`${FOLDER_KEY_PREFIX}${username}`));
    return Number.isInteger(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function saveFolderChoice(username: string, folderId: number) {
  try {
    const storage = getStorage("localStorage");
    const key = `${FOLDER_KEY_PREFIX}${username}`;
    if (folderId) storage?.setItem(key, String(folderId));
    else storage?.removeItem(key);
  } catch {
    // Not remembered.
  }
}

/**
 * Manages Discogs username input, collection loading state, and album ordering updates.
 *
 * @param session The visitor signed in with Discogs, if any: their own access loads private
 *   collections and their folders.
 * @param onSignedOut Called when Discogs no longer accepts the visitor's sign-in.
 * @returns Collection state plus actions for loading, retrying, reordering and undoing.
 */
export function useCollection(session: DiscogsSession | null = null, onSignedOut?: () => void) {
  const [albums, setAlbums] = useState<Album[]>([]);
  // What the user typed; until they type, the box shows the name from a share link, or the name
  // loaded last time on this device.
  const [typedUsername, setTypedUsername] = useState<string | null>(null);
  const hash = useSyncExternalStore(subscribeToNothing, getLocationHash, getNoHash);
  // A link such as `?user=someone` opens that collection directly.
  const search = useSyncExternalStore(subscribeToNothing, getLocationSearch, getNoHash);
  const linkedUser = useMemo(() => userFromAddress(search), [search]);
  const lastUsername = useSyncExternalStore(subscribeToNothing, getLastUsername, getNoUsername);
  const linkedWallState = useMemo(() => getSharedWallStateFromHash(hash), [hash]);
  const linkedIsDemo = linkedWallState?.username === DEMO_USERNAME;
  const username =
    typedUsername ??
    (linkedIsDemo ? undefined : linkedWallState?.username) ??
    linkedUser ??
    lastUsername ??
    "";
  const [loadedUsername, setLoadedUsername] = useState("");
  // Counts finished loads, so the wall starts afresh even when a load finishes without a
  // visible loading state (a cached collection).
  const [loadCount, setLoadCount] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<CollectionErrorKind>(null);
  // The signed-in visitor's chosen folder (per visitor); undefined until they choose one here.
  const [chosenFolder, setChosenFolder] = useState<{ username: string; id: number } | null>(null);
  const folderId = !session
    ? 0
    : chosenFolder && sameName(chosenFolder.username, session.username)
      ? chosenFolder.id
      : loadFolderChoice(session.username.toLowerCase());
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [sharedWallState, setSharedWallState] = useState<SharedWallState | null>(null);
  const [demoAlbums, setDemoAlbums] = useState<Album[] | null>(null);
  const [demoStatus, setDemoStatus] = useState<"loading" | "done">("loading");
  const history = useUndoHistory<Album[]>();
  const { clear: clearHistory, record: recordHistory, undo: undoHistory } = history;

  /**
   * Clears both collection-level and username validation errors.
   */
  const clearErrors = () => {
    setError(null);
    setErrorKind(null);
    setUsernameError(null);
  };

  /**
   * Loads a Discogs collection for a specific username. The wall comes from a share link when
   * there is one, otherwise from the wall saved on this device for that username.
   *
   * @param usernameToLoad Username whose collection should be loaded.
   * @param linkedState Parsed shared wall state, if the load originated from a share link.
   * @param fresh Skip the recently loaded copy and ask Discogs again.
   * @param folder Folder to load when this is the signed-in visitor's own collection.
   */
  const loadCollectionForUsername = useCallback(
    async (
      usernameToLoad: string,
      linkedState: SharedWallState | null = null,
      fresh = false,
      folder = folderId
    ) => {
      if (!usernameToLoad.trim()) return;

      if (!validateDiscogsUsername(usernameToLoad)) {
        setUsernameError(VALIDATION_ERROR_MESSAGE);
        return;
      }

      setError(null);
      setErrorKind(null);
      setUsernameError(null);
      const own = session !== null && sameName(session.username, usernameToLoad);
      // A folder is only loaded for the signed-in visitor's own collection; a shared wall always
      // opens with the whole collection, which holds every folder's records.
      const loadFolder = own && !linkedState ? folder : 0;
      const cacheKey = loadFolder ? `${usernameToLoad}#${loadFolder}` : usernameToLoad;
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
              : readCachedCollection(sessionStore, cacheKey, Date.now());
          const collection =
            cached ??
            (await (session
              ? getUserCollection(usernameToLoad, undefined, { session, folderId: loadFolder })
              : getUserCollection(usernameToLoad)));
          if (!cached && sessionStore) {
            writeCachedCollection(sessionStore, cacheKey, collection, Date.now());
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
          // The address names the collection, so the page can be bookmarked or shared; a shared
          // wall keeps its own link.
          if (!linkedState) setAddressUser(usernameToLoad);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : GENERIC_ERROR_MESSAGE;
          const code = proxyErrorCode(err);
          if (code === "signed-out" && session) {
            onSignedOut?.();
            setErrorKind("signed-out");
            setError(SIGNED_OUT_MESSAGE);
          } else if (code === "private" && linkedState && !own) {
            setErrorKind("private-shared");
            setError(PRIVATE_SHARED_WALL_MESSAGE);
          } else {
            setErrorKind(collectionErrorKind(err));
            setError(errorMessage);
          }
        }
      });
    },
    [startTransition, clearHistory, session, folderId, onSignedOut]
  );

  /**
   * Chooses a folder of the signed-in visitor's collection, and loads it when their collection is
   * the one entered.
   *
   * @param id Folder id; 0 is the whole collection.
   */
  const chooseFolder = (id: number) => {
    if (!session) return;
    setChosenFolder({ username: session.username, id });
    saveFolderChoice(session.username.toLowerCase(), id);
    if (sameName(username, session.username)) {
      setSharedWallState(null);
      void loadCollectionForUsername(session.username, null, false, id);
    }
  };

  /**
   * Loads the signed-in visitor's own collection (straight after signing in).
   *
   * @param name Their Discogs username.
   */
  const loadOwnCollection = (name: string) => {
    setTypedUsername(name);
    void loadCollectionForUsername(name);
  };

  /**
   * Validates the username (the one in the box, or the one given) and loads the user's Discogs collection.
   * Stores the last successfully loaded username for display after input changes.
   */
  const loadCollection = async (name?: string) => {
    if (name !== undefined) setTypedUsername(name);
    await loadCollectionForUsername(name ?? username);
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

  /**
   * Loads the fictional demo wall from the local file. Shows the wall from a share link when there
   * is one, otherwise the wall saved on this device. Never contacts Discogs and does not change
   * the remembered username or the recently loaded collection.
   *
   * @param linkedState Parsed shared wall state, if the load came from a share link.
   */
  const loadDemo = useCallback(
    (linkedState: SharedWallState | null = null) => {
      if (!demoAlbums) return;
      const localStore = getStorage("localStorage");
      const savedState = localStore ? loadSavedWall(localStore, DEMO_USERNAME) : null;
      const wallState = linkedState ?? savedState;
      setSharedWallState(wallState);
      setAlbums(wallState ? orderAlbumsBySharedWall(demoAlbums, wallState) : demoAlbums);
      setLoadedUsername(DEMO_USERNAME);
      setLoadCount((count) => count + 1);
      clearHistory();
      setAddressUser(null);
      setError(null);
      setErrorKind(null);
      setUsernameError(null);
    },
    [demoAlbums, clearHistory]
  );

  // A share link in the address loads its collection once, when the page opens.
  const startedFromLink = useRef(false);
  useEffect(() => {
    if (!linkedWallState || startedFromLink.current) return;
    if (linkedWallState.username === DEMO_USERNAME) return;
    startedFromLink.current = true;
    queueMicrotask(() => void loadCollectionForUsername(linkedWallState.username, linkedWallState));
  }, [linkedWallState, loadCollectionForUsername]);

  // A `?user=` link loads its collection once, when the page opens (a share link wins).
  const startedFromUser = useRef(false);
  useEffect(() => {
    if (startedFromUser.current || linkedWallState || !linkedUser) return;
    startedFromUser.current = true;
    queueMicrotask(() => void loadCollectionForUsername(linkedUser));
  }, [linkedWallState, linkedUser, loadCollectionForUsername]);

  // A demo share link waits for the demo file, then opens the demo once.
  const startedFromDemoLink = useRef(false);
  useEffect(() => {
    if (!linkedWallState || linkedWallState.username !== DEMO_USERNAME) return;
    if (startedFromDemoLink.current || !demoAlbums) return;
    startedFromDemoLink.current = true;
    queueMicrotask(() => loadDemo(linkedWallState));
  }, [linkedWallState, demoAlbums, loadDemo]);

  // Fetch the demo collection once on mount. The demo is offered only when the file loads and
  // parses; a missing or invalid file leaves the normal username flow untouched.
  useEffect(() => {
    let cancelled = false;
    const loadDemoCollection = async () => {
      try {
        const res = await fetch(`${getBasePath()}/demo/collection.json`);
        if (!res.ok) return;
        const parsed = parseDemoCollection(await res.json());
        if (!cancelled && parsed) setDemoAlbums(parsed);
      } catch {
        // No demo offered.
      } finally {
        if (!cancelled) setDemoStatus("done");
      }
    };
    void loadDemoCollection();
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    // State
    albums,
    username,
    loadedUsername,
    loadCount,
    sharedWallState,
    isPending,
    error:
      error ?? (linkedIsDemo && demoStatus === "done" && !demoAlbums ? DEMO_MISSING_MESSAGE : null),
    errorKind,
    folderId,
    usernameError,
    demoAvailable: demoAlbums !== null,
    canUndo: history.canUndo,
    // Actions
    loadCollection,
    handleUsernameChange,
    handleAlbumsReorder,
    undo,
    forgetUndo,
    retry,
    loadDemo,
    chooseFolder,
    loadOwnCollection,
  };
}
