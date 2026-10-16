import { useState } from "react";

/**
 * Whether album labels show under the covers: off until the user turns them on.
 *
 * @returns Whether labels show, and a toggle.
 */
export function useAlbumLabels() {
  const [showAlbumLabels, setShowAlbumLabels] = useState(false);
  const toggleAlbumLabels = () => setShowAlbumLabels((shown) => !shown);
  return { showAlbumLabels, toggleAlbumLabels };
}
