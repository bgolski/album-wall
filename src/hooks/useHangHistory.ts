import { useMemo, useState } from "react";
import {
  addHang,
  hangHistoryKey,
  lastHung,
  mergeHangs,
  parseHangs,
  serializeHangs,
  type HangRecord,
} from "@/utils/hangHistory";

type HistoryStorage = Pick<Storage, "getItem" | "setItem">;

interface HangHistoryOptions {
  /** Where history is kept; `null` for nowhere, omitted for the browser's local storage. */
  storage?: HistoryStorage | null;
  /** Clock, replaceable for tests. */
  now?: () => Date;
}

const NO_STORAGE = "This browser is not letting the page save anything, so history cannot be kept.";
const STORAGE_FULL = "This browser's storage is full, so the change was not saved.";

function browserStorage(): HistoryStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Remembers which walls the user hung and when, for one collection, in this browser. Every change
 * returns `null` when it worked or a message saying why it did not.
 *
 * @param collectionName Collection the history belongs to.
 * @param options Replacements for storage and clock.
 * @returns The records, when each album was last hung, and the actions.
 */
export function useHangHistory(collectionName: string, options: HangHistoryOptions = {}) {
  const storage = options.storage === undefined ? browserStorage() : options.storage;
  const now = options.now ?? (() => new Date());
  const key = hangHistoryKey(collectionName);

  // Kept with the key it was read for, so switching collections reads that collection's history.
  const [state, setState] = useState(() => ({ key, hangs: readHangs(storage, key) }));
  const hangs = state.key === key ? state.hangs : readHangs(storage, key);
  const last = useMemo(() => lastHung(hangs), [hangs]);

  const commit = (next: HangRecord[]): string | null => {
    if (!storage) return NO_STORAGE;
    try {
      storage.setItem(key, serializeHangs(next));
    } catch {
      return STORAGE_FULL;
    }
    setState({ key, hangs: next });
    return null;
  };

  return {
    hangs,
    lastHung: last,
    /** Records the albums as hung today. */
    markHung: (albumIds: string[]) => commit(addHang(hangs, albumIds, now())),
    /** Forgets every wall. */
    clear: () => commit([]),
    /** Adds records from a backup file. */
    merge: (incoming: unknown[]) => commit(mergeHangs(hangs, incoming)),
  };
}

function readHangs(storage: HistoryStorage | null, key: string): HangRecord[] {
  try {
    return parseHangs(storage ? storage.getItem(key) : null);
  } catch {
    return [];
  }
}
