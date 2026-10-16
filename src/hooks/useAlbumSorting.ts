import { useState } from "react";

/** How the wall is being arranged: by hand, or built by artist, genre, year or color. */
export type SortOption = "none" | "artist" | "genre" | "year" | "color";

/**
 * Tracks the active Arrange mode. Every mode other than "By hand" opens its panel, and the wall
 * changes only when that panel builds one, so choosing a mode never reorders the collection.
 *
 * @returns The current mode and an action for changing it.
 */
export function useAlbumSorting() {
  const [sortOption, setSortOption] = useState<SortOption>("none");
  return { sortOption, handleSortChange: setSortOption };
}
