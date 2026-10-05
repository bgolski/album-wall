import { encodeSharedWallState, decodeSharedWallState } from "./shareState";
import type { SharedWallState } from "@/types";

/**
 * Prefix for keys used to store wall state in storage.
 */
const WALL_KEY_PREFIX = "album-wall:wall:";
/**
 * Key used to persist the last entered username.
 */
const LAST_USERNAME_KEY = "album-wall:last-username";

/**
 * Normalises a username by trimming whitespace and lower‑casing.
 * @param name The username to normalise.
 * @returns A lower‑cased, trimmed string.
 */
function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Generates the storage key for a given username.
 * @param username The username to generate a key for.
 * @returns The key used to store the wall for that user.
 */
export function savedWallKey(username: string): string {
  return `${WALL_KEY_PREFIX}${normalizeName(username)}`;
}

/**
 * Stores a wall state for the user that owns the state.
 *
 * @param storage Picked from the Web Storage API, only the `setItem` method is needed.
 * @param state The shared wall state to persist.
 * @returns `true` if storage succeeded, `false` if it threw.
 */
export function saveWall(storage: Pick<Storage, "setItem">, state: SharedWallState): boolean {
  try {
    const key = savedWallKey(state.username);
    storage.setItem(key, encodeSharedWallState(state));
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads a wall state for the given username.
 *
 * @param storage Picked from the Web Storage API, only the `getItem` method is needed.
 * @param username The username whose wall should be loaded.
 * @returns The decoded wall state, or `null` if none exists, is damaged, belongs to another user, or an error occurred.
 */
export function loadSavedWall(
  storage: Pick<Storage, "getItem">,
  username: string
): SharedWallState | null {
  try {
    const key = savedWallKey(username);
    const encoded = storage.getItem(key);
    if (!encoded) return null;
    const decoded = decodeSharedWallState(encoded);
    if (!decoded) return null;
    if (normalizeName(decoded.username) !== normalizeName(username)) return null;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Deletes the stored wall for the specified user.
 *
 * @param storage Picked from the Web Storage API, only the `removeItem` method is needed.
 * @param username The username whose wall should be removed.
 */
export function forgetWall(storage: Pick<Storage, "removeItem">, username: string): void {
  try {
    const key = savedWallKey(username);
    storage.removeItem(key);
  } catch {
    /* ignore errors */
  }
}

/**
 * Persists the last username that the user entered.
 *
 * @param storage Picked from the Web Storage API, only the `setItem` method is needed.
 * @param name The username to persist.
 */
export function saveLastUsername(storage: Pick<Storage, "setItem">, name: string): void {
  try {
    const trimmed = name.trim();
    if (!trimmed) return;
    storage.setItem(LAST_USERNAME_KEY, trimmed);
  } catch {
    /* ignore errors */
  }
}

/**
 * Retrieves the last entered username.
 *
 * @param storage Picked from the Web Storage API, only the `getItem` method is needed.
 * @returns The trimmed username, or `null` if not set, blank, or an error occurred.
 */
export function loadLastUsername(storage: Pick<Storage, "getItem">): string | null {
  try {
    const val = storage.getItem(LAST_USERNAME_KEY);
    if (!val) return null;
    const trimmed = val.trim();
    if (!trimmed) return null;
    return trimmed;
  } catch {
    return null;
  }
}
