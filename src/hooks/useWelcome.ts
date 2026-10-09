import { useCallback, useSyncExternalStore } from "react";
import { loadLastUsername } from "@/utils/savedWall";

const WELCOME_DISMISSED_KEY = "album-wall:welcome-dismissed";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Whether this looks like a first visit: no share link in the address, no earlier dismissal, and
 * no collection loaded here before. Browsers that block storage never get the welcome.
 */
function isFirstVisit(): boolean {
  try {
    if (window.location.hash.includes("share=")) return false;
    const storage = window.localStorage;
    return !storage.getItem(WELCOME_DISMISSED_KEY) && !loadLastUsername(storage);
  } catch {
    return false;
  }
}

function neverOnServer() {
  return false;
}

/**
 * Decides whether to greet a newcomer with the demo offer, and remembers when they are done with it.
 *
 * @param demoAvailable Whether the demo wall can be loaded.
 * @param hasWall Whether a wall is already showing.
 * @returns Whether the welcome should show, and a function that dismisses it for good.
 */
export function useWelcome(demoAvailable: boolean, hasWall: boolean) {
  const firstVisit = useSyncExternalStore(subscribe, isFirstVisit, neverOnServer);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(WELCOME_DISMISSED_KEY, "1");
    } catch {
      // Storage is blocked; the welcome is not shown in that case anyway.
    }
    listeners.forEach((listener) => listener());
  }, []);

  return { open: firstVisit && demoAvailable && !hasWall, dismiss };
}
