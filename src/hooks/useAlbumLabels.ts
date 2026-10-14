import { useState, useSyncExternalStore } from "react";

const WIDE_SCREEN_QUERY = "(min-width: 768px)";

function subscribeToWideScreen(onChange: () => void) {
  const query = window.matchMedia(WIDE_SCREEN_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getWideScreen() {
  return window.matchMedia(WIDE_SCREEN_QUERY).matches;
}

function getNoScreen() {
  return null;
}

/**
 * Whether album labels show under the covers: on wide screens by default, off on narrow ones,
 * until the user toggles them.
 *
 * @returns Whether labels show (`null` before the screen is known) and a toggle.
 */
export function useAlbumLabels() {
  const [labelsOverride, setLabelsOverride] = useState<boolean | null>(null);
  const wideScreen = useSyncExternalStore(subscribeToWideScreen, getWideScreen, getNoScreen);
  const showAlbumLabels = labelsOverride ?? wideScreen;

  const toggleAlbumLabels = () => setLabelsOverride(!(showAlbumLabels ?? false));

  return { showAlbumLabels, toggleAlbumLabels };
}
