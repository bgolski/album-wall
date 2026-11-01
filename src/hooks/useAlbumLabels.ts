import { useState } from "react";

/**
 * Whether album labels show under the covers: off until the user turns them on.
 */
export function useAlbumLabels() {
  const [showAlbumLabels, setShowAlbumLabels] = useState(false);
  const toggleAlbumLabels = () => setShowAlbumLabels((shown) => !shown);
  return { showAlbumLabels, toggleAlbumLabels };
}
