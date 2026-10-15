import { createContext, useContext } from "react";
import type { SavedWallsClient } from "@/utils/savedWalls";

/** The signed-in visitor's saved walls, or `null` when nobody is signed in. */
export const SavedWallsContext = createContext<SavedWallsClient | null>(null);

/** The signed-in visitor's saved walls client, or `null`. */
export function useSavedWallsClient() {
  return useContext(SavedWallsContext);
}
