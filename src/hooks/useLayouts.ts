import { useState } from "react";
import type { SharedWallState } from "@/types";
import {
  addLayout,
  deleteLayout,
  exportBundle,
  importBundle,
  LayoutError,
  layoutsKey,
  MAX_LAYOUTS,
  parseLayouts,
  renameLayout,
  serializeLayouts,
  type SavedLayout,
} from "@/utils/layoutStore";

type LayoutStorage = Pick<Storage, "getItem" | "setItem">;

interface LayoutOptions {
  /** Where layouts are kept; `null` for nowhere, omitted for the browser's local storage. */
  storage?: LayoutStorage | null;
  /** Clock, replaceable for tests. */
  now?: () => Date;
  /** Makes a new layout id, replaceable for tests. */
  newId?: () => string;
  /** Wall history to include in backups and restore from them. */
  history?: { hangs: unknown[]; merge: (incoming: unknown[]) => string | null };
}

const MESSAGES: Record<LayoutError["code"], string> = {
  "empty-name": "Give the layout a name.",
  limit: `You can keep up to ${MAX_LAYOUTS} layouts. Delete one to save another.`,
  "invalid-file": "That file is not an Album Wall layouts file.",
};
const NO_STORAGE = "This browser is not letting the page save anything, so layouts cannot be kept.";
const STORAGE_FULL = "This browser's storage is full, so the change was not saved.";

function browserStorage(): LayoutStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function read(storage: LayoutStorage | null, key: string): string | null {
  try {
    return storage ? storage.getItem(key) : null;
  } catch {
    return null;
  }
}

function makeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Asks the browser not to clear this site's storage on its own; harmless if it says no.
function askToKeepStorage() {
  try {
    void navigator.storage?.persist?.().catch(() => undefined);
  } catch {
    // Not supported.
  }
}

/**
 * Keeps a collection's named layouts in this browser and backs them up to a file. Every change
 * returns `null` when it worked or a message saying why it did not.
 *
 * @param collectionName Collection the layouts belong to.
 * @param options Replacements for storage, clock and ids.
 * @returns The layouts, the actions, and whether any layout has not been exported yet.
 */
export function useLayouts(collectionName: string, options: LayoutOptions = {}) {
  const storage = options.storage === undefined ? browserStorage() : options.storage;
  const now = options.now ?? (() => new Date());
  const newId = options.newId ?? makeId;
  const key = layoutsKey(collectionName);
  const exportedKey = `album-wall:layouts-exported:${collectionName.trim().toLowerCase()}`;

  const [layouts, setLayouts] = useState<SavedLayout[]>(() => parseLayouts(read(storage, key)));
  const [exportedAt, setExportedAt] = useState<string | null>(() => read(storage, exportedKey));

  const commit = (next: SavedLayout[]): string | null => {
    if (!storage) return NO_STORAGE;
    try {
      storage.setItem(key, serializeLayouts(next));
    } catch {
      return STORAGE_FULL;
    }
    setLayouts(next);
    return null;
  };

  const attempt = (change: () => SavedLayout[]): string | null => {
    try {
      return commit(change());
    } catch (error) {
      if (error instanceof LayoutError) return MESSAGES[error.code];
      throw error;
    }
  };

  const save = (name: string, wall: SharedWallState) => {
    const problem = attempt(() => addLayout(layouts, name, wall, now(), newId()));
    if (!problem) askToKeepStorage();
    return problem;
  };

  const rename = (id: string, name: string) => attempt(() => renameLayout(layouts, id, name));

  const remove = (id: string) => attempt(() => deleteLayout(layouts, id));

  /** Adds the layouts in a backup file's text, never replacing one already here. */
  const importText = (text: string): { ok: boolean; message: string } => {
    try {
      const result = importBundle(layouts, text);
      const problem = commit(result.layouts);
      if (problem) return { ok: false, message: problem };
      const restoredHistory =
        result.hangs.length > 0 && options.history && !options.history.merge(result.hangs);
      const added = `Added ${result.added} ${result.added === 1 ? "layout" : "layouts"}`;
      const skipped =
        result.skipped > 0 ? `, skipped ${result.skipped} already here or damaged` : "";
      const history = restoredHistory ? " and the wall history" : "";
      return { ok: true, message: `${added}${skipped}${history}.` };
    } catch (error) {
      if (error instanceof LayoutError) return { ok: false, message: MESSAGES[error.code] };
      return { ok: false, message: MESSAGES["invalid-file"] };
    }
  };

  /** The backup file's text for every layout; marks them as backed up. */
  const exportText = () => {
    const stamp = now().toISOString();
    try {
      storage?.setItem(exportedKey, stamp);
    } catch {
      // The reminder to back up just stays.
    }
    setExportedAt(stamp);
    return exportBundle(layouts, options.history?.hangs ?? []);
  };

  const needsBackup =
    layouts.length > 0 &&
    (exportedAt === null || layouts.some((layout) => layout.savedAt > exportedAt));

  return { layouts, save, rename, remove, importText, exportText, needsBackup };
}
