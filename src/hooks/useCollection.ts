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
import {
  loadLastUsername,
  loadSavedWall,
  saveLastUsername,
  loadFolderChoice,
  saveFolderChoice,
} from "@/utils/savedWall";
import { readCachedCollection, writeCachedCollection } from "@/utils/collectionCache";
import { useUndoHistory } from "@/hooks/useUndoHistory";
import { DEMO_USERNAME, parseDemoCollection } from "@/utils/demoCollection";
import { getBasePath } from "@/utils/basePath";
import { setAddressUser, userFromAddress } from "@/utils/loadAddress";
import { DiscogsSession, proxyErrorCode } from "@/utils/discogsSignIn";
import { localStore, sessionStore } from "@/utils/browserStorage";

const VALIDATION_ERROR_MESSAGE = "Letters, numbers, dots, dashes and underscores only";
const DEMO_MISSING_MESSAGE = "Demo unavailable";
const GENERIC_ERROR_MESSAGE = "An unexpected error occurred. Please try again.";
const PRIVATE_SHARED_WALL_MESSAGE =
  "This wall was shared from a private Discogs collection, so only its owner can open it here. If it is yours, sign in with Discogs. Otherwise ask them for a saved image of the wall, or to make their collection public on Discogs.";
const SIGNED_OUT_MESSAGE = "Signed out";

/** Why a load failed, when the app can say more than the message. */
export type CollectionErrorKind =
  "private" | "private-shared" | "signed-out" | "not-found" | "busy" | "unavailable" | null;

/** A failed load: the message, and why when the app knows. */
export interface CollectionError {
  message: string;
  kind: CollectionErrorKind;
}

/**
 * Sorts a failed load by what the visitor can do about it.
 *
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
  const storage = localStore();
  return storage ? loadLastUsername(storage) : null;
}

function getNoUsername() {
  return null;
}

function sameName(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
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
  const [error, setError] = useState<CollectionError | null>(null);
  // The signed-in visitor's chosen folder (per visitor); undefined until they choose one here.
  const [chosenFolder, setChosenFolder] = useState<{ username: string; id: number } | null>(null);
  const folderId = !session
    ? 0
    : chosenFolder && sameName(chosenFolder.username, session.username)
      ? chosenFolder.id
      : loadFolderChoice(localStore(), session.username.toLowerCase());
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [sharedWallState, setSharedWallState] = useState<SharedWallState | null>(null);
  const [demoAlbums, setDemoAlbums] = useState<Album[] | null>(null);
  const [demoStatus, setDemoStatus] = useState<"loading" | "done">("loading");
  const history = useUndoHistory<Album[]>();
  const { clear: clearHistory, record: recordHistory, undo: undoHistory } = history;

  /**
   * Clears both collection-level and username validation errors.
   */
  const clearErrors = useCallback(() => {
    setError(null);
    setUsernameError(null);
  }, []);

  /**
   * Puts a loaded collection on the wall, in the order of the given wall when there is one, and
   * starts the wall afresh.
   *
   * @param wallState The wall to order them by, if any.
   */
  const showCollection = useCallback(
    (name: string, collection: Album[], wallState: SharedWallState | null) => {
      setAlbums(wallState ? orderAlbumsBySharedWall(collection, wallState) : collection);
      setLoadedUsername(name);
      setLoadCount((count) => count + 1);
      clearHistory();
    },
    [clearHistory]
  );

  /**
   * Loads a Discogs collection for a specific username. The wall comes from a share link when
   * there is one, otherwise from the wall saved on this device for that username.
   *
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

      clearErrors();
      const own = session !== null && sameName(session.username, usernameToLoad);
      // A folder is only loaded for the signed-in visitor's own collection; a shared wall always
      // opens with the whole collection, which holds every folder's records.
      const loadFolder = own && !linkedState ? folder : 0;
      const cacheKey = loadFolder ? `${usernameToLoad}#${loadFolder}` : usernameToLoad;
      const store = localStore();
      const savedState = store ? loadSavedWall(store, usernameToLoad) : null;
      const wallState =
        linkedState ?? (savedState ? { ...savedState, username: usernameToLoad } : null);
      setSharedWallState(wallState);

      startTransition(async () => {
        try {
          const storage = sessionStore();
          const cached =
            fresh || !storage ? null : readCachedCollection(storage, cacheKey, Date.now());
          const collection =
            cached ??
            (await (session
              ? getUserCollection(usernameToLoad, undefined, { session, folderId: loadFolder })
              : getUserCollection(usernameToLoad)));
          if (!cached && storage) {
            writeCachedCollection(storage, cacheKey, collection, Date.now());
          }
          showCollection(
            usernameToLoad,
            collection,
            wallState?.username === usernameToLoad ? wallState : null
          );
          if (store) saveLastUsername(store, usernameToLoad);
          // The address names the collection, so the page can be bookmarked or shared; a shared
          // wall keeps its own link.
          if (!linkedState) setAddressUser(usernameToLoad);
        } catch (err) {
          const code = proxyErrorCode(err);
          if (code === "signed-out" && session) {
            onSignedOut?.();
            setError({ message: SIGNED_OUT_MESSAGE, kind: "signed-out" });
          } else if (code === "private" && linkedState && !own) {
            setError({ message: PRIVATE_SHARED_WALL_MESSAGE, kind: "private-shared" });
          } else {
            setError({
              message: err instanceof Error ? err.message : GENERIC_ERROR_MESSAGE,
              kind: collectionErrorKind(err),
            });
          }
        }
      });
    },
    [startTransition, clearErrors, showCollection, session, folderId, onSignedOut]
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
    saveFolderChoice(localStore(), session.username.toLowerCase(), id);
    if (sameName(username, session.username)) {
      setSharedWallState(null);
      void loadCollectionForUsername(session.username, null, false, id);
    }
  };

  /**
   * Validates the username (the one in the box, or the one given, which then goes in the box) and
   * loads the user's Discogs collection. Stores the last successfully loaded username for display
   * after input changes.
   *
   * @param name Username to load instead of the one in the box, such as the visitor's own
   *   straight after signing in.
   */
  const loadCollection = async (name?: string) => {
    if (name !== undefined) setTypedUsername(name);
    await loadCollectionForUsername(name ?? username);
  };

  /**
   * Updates the username input and clears visible errors once the user edits the field.
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
      const store = localStore();
      const savedState = store ? loadSavedWall(store, DEMO_USERNAME) : null;
      const wallState = linkedState ?? savedState;
      setSharedWallState(wallState);
      showCollection(DEMO_USERNAME, demoAlbums, wallState);
      setAddressUser(null);
      clearErrors();
    },
    [demoAlbums, showCollection, clearErrors]
  );

  // The address decides the first load, once, when the page opens: a share link wins over a
  // `?user=` link, and a demo share link waits for the demo file.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    if (linkedWallState?.username === DEMO_USERNAME) {
      if (!demoAlbums) return;
      started.current = true;
      queueMicrotask(() => loadDemo(linkedWallState));
    } else if (linkedWallState) {
      started.current = true;
      queueMicrotask(
        () => void loadCollectionForUsername(linkedWallState.username, linkedWallState)
      );
    } else if (linkedUser) {
      started.current = true;
      queueMicrotask(() => void loadCollectionForUsername(linkedUser));
    }
  }, [linkedWallState, linkedUser, demoAlbums, loadDemo, loadCollectionForUsername]);

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
      error ??
      (linkedIsDemo && demoStatus === "done" && !demoAlbums
        ? { message: DEMO_MISSING_MESSAGE, kind: null }
        : null),
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
  };
}
