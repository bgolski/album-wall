import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { loadLastUsername } from "@/utils/savedWall";

const WELCOME_DISMISSED_KEY = "album-wall:welcome-dismissed";

// How long the record's spin-up takes (see globals.css); the welcome waits for it so the two do not
// play over each other.
const INTRO_MS = 3000;

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
 * @returns Whether the welcome should show (once the intro, if any, is over), and a function that
 *          dismisses it for good.
 */
export function useWelcome(demoAvailable: boolean, hasWall: boolean) {
  const firstVisit = useSyncExternalStore(subscribe, isFirstVisit, neverOnServer);
  // The page marks itself `data-intro` while the record's spin-up plays; wait for it to finish.
  const [introOver, setIntroOver] = useState(
    () => typeof document === "undefined" || !document.documentElement.hasAttribute("data-intro")
  );
  useEffect(() => {
    if (introOver) return;
    const timer = setTimeout(() => setIntroOver(true), INTRO_MS);
    return () => clearTimeout(timer);
  }, [introOver]);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(WELCOME_DISMISSED_KEY, "1");
    } catch {
      // Storage is blocked; the welcome is not shown in that case anyway.
    }
    listeners.forEach((listener) => listener());
  }, []);

  return { open: firstVisit && demoAvailable && !hasWall && introOver, dismiss };
}
