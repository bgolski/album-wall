import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  DiscogsSession,
  SESSION_KEY,
  clearPending,
  clearSession,
  finishDiscogsSignIn,
  loadPending,
  parseSession,
  readSignInReturn,
  savePending,
  saveSession,
  startDiscogsSignIn,
} from "@/account/discogsSignIn";
import { clearCachedCollections } from "@/collection/collectionCache";
import { localStore, sessionStore } from "@/utils/browserStorage";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  // A sign-in or sign-out in another tab.
  const onStorage = (event: StorageEvent) => {
    if (event.key === SESSION_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function notify() {
  for (const listener of listeners) listener();
}

let lastRaw: string | null = null;
let lastSession: DiscogsSession | null = null;

function getSession(): DiscogsSession | null {
  let raw: string | null = null;
  try {
    raw = localStore()?.getItem(SESSION_KEY) ?? null;
  } catch {
    raw = null;
  }
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastSession = parseSession(raw);
  }
  return lastSession;
}

function getNoSession() {
  return null;
}

function goTo(url: string) {
  window.location.assign(url);
}

/** The page's own address without query or hash: where Discogs sends the visitor back. */
function callbackAddress() {
  return `${window.location.origin}${window.location.pathname}`;
}

/**
 * Signing in with Discogs: starts the sign-in, finishes it when Discogs sends the visitor back,
 * and signs out. The visitor's access token is kept in this browser's local storage only.
 *
 * @param navigate Opens the Discogs approval page.
 * @returns The signed-in visitor (or null), the sign-in state and the actions.
 */
export function useDiscogsSignIn(navigate: (url: string) => void = goTo) {
  const session = useSyncExternalStore(subscribe, getSession, getNoSession);
  const [status, setStatus] = useState<"idle" | "redirecting" | "finishing">("idle");
  const [error, setError] = useState<string | null>(null);
  // The username that has just signed in, so the app can load their collection once.
  const [justSignedIn, setJustSignedIn] = useState<string | null>(null);

  // When Discogs sends the visitor back, the page opens with its answer in the query string.
  const handledReturn = useRef(false);
  useEffect(() => {
    if (handledReturn.current) return;
    handledReturn.current = true;
    const answer = readSignInReturn(window.location.search);
    if (!answer) return;
    const storage = sessionStore();
    const pending = storage ? loadPending(storage) : null;
    if (storage) clearPending(storage);
    // Take Discogs' answer out of the address and put back the wall the visitor left from.
    const restoreAddress = () =>
      window.history.replaceState(null, "", `${callbackAddress()}${pending?.returnHash ?? ""}`);

    if (answer.kind === "denied") {
      restoreAddress();
      queueMicrotask(() => setError("Sign-in cancelled"));
      return;
    }
    if (!pending || pending.token !== answer.token) {
      restoreAddress();
      queueMicrotask(() => setError("Sign-in failed"));
      return;
    }

    queueMicrotask(() => setStatus("finishing"));
    void finishDiscogsSignIn(pending, answer.verifier)
      .then((next) => {
        const store = localStore();
        restoreAddress();
        if (!store || !saveSession(store, next)) {
          setError("This browser blocks sign-in");
          return;
        }
        notify();
        if (!pending.returnHash) setJustSignedIn(next.username);
      })
      .catch((reason: unknown) => {
        restoreAddress();
        setError(reason instanceof Error ? reason.message : "Sign-in failed");
      })
      .finally(() => setStatus("idle"));
  }, []);

  /**
   * Sends the visitor to Discogs to approve Album Wall.
   */
  const signIn = useCallback(async () => {
    setError(null);
    setStatus("redirecting");
    try {
      const storage = sessionStore();
      if (!storage) throw new Error("This browser does not allow signing in.");
      const started = await startDiscogsSignIn(callbackAddress());
      const saved = savePending(storage, {
        token: started.token,
        secret: started.secret,
        returnHash: window.location.hash,
      });
      if (!saved) throw new Error("This browser does not allow signing in.");
      navigate(started.authorizeUrl);
    } catch (reason) {
      setStatus("idle");
      setError(reason instanceof Error ? reason.message : "Sign-in failed");
    }
  }, [navigate]);

  /**
   * Forgets the access token and anything loaded with it in this browser.
   */
  const signOut = useCallback(() => {
    const current = getSession();
    const store = localStore();
    const storage = sessionStore();
    if (store) clearSession(store);
    if (storage && current) clearCachedCollections(storage, current.username);
    setJustSignedIn(null);
    setError(null);
    notify();
  }, []);

  return {
    session,
    status,
    error,
    justSignedIn,
    signIn,
    signOut,
    /** Shows a sign-in problem found elsewhere (Discogs no longer accepting the token). */
    setError,
  };
}
