import { useEffect, useRef } from "react";
import type { SavedKind } from "@/account/savedWalls";
import { useSavedWallsClient } from "./savedWallsContext";

type MarkerStorage = Pick<Storage, "getItem" | "setItem">;

/** What this browser last agreed with the account on, and whether it has changes not yet sent. */
interface SyncMarker {
  updatedAt: string | null;
  dirty: boolean;
}

interface AccountSyncOptions<T> {
  kind: SavedKind;
  collection: string;
  /** The list as this browser has it now. */
  items: T[];
  /** Puts a list in this browser (local storage and state) without sending it. */
  apply: (items: T[]) => void;
  parse: (text: string | null) => T[];
  serialize: (items: T[]) => string;
  /** Combines two lists so nothing in either is lost. */
  union: (local: T[], remote: T[]) => T[];
  /** Where the sync markers are kept; the browser's local storage when omitted. */
  storage: MarkerStorage | null;
}

export const syncMarkerKey = (account: string, kind: SavedKind, collection: string) =>
  `album-wall:saved-sync:${account.toLowerCase()}:${kind}:${collection.trim().toLowerCase()}`;

function readMarker(storage: MarkerStorage | null, key: string): SyncMarker | null {
  try {
    const value = JSON.parse(storage?.getItem(key) ?? "null") as Partial<SyncMarker> | null;
    if (!value || typeof value !== "object") return null;
    return {
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
      dirty: value.dirty === true,
    };
  } catch {
    return null;
  }
}

function writeMarker(storage: MarkerStorage | null, key: string, marker: SyncMarker) {
  try {
    storage?.setItem(key, JSON.stringify(marker));
  } catch {
    // Without a marker the next visit merges again, which loses nothing.
  }
}

/**
 * Keeps a collection's list (layouts or wall history) in the signed-in visitor's account as well
 * as in this browser. When a collection opens, the account's copy is fetched: the first time on
 * this browser, or when this browser has changes that were not sent, the two are combined so
 * nothing is lost; otherwise a newer copy from another device replaces this one. Every change is
 * then sent. Signed out, it does nothing.
 *
 * @returns `push`, to call after each change this browser makes.
 */
export function useAccountSync<T>(options: AccountSyncOptions<T>) {
  const client = useSavedWallsClient();
  const latest = useRef(options);
  // The newest list and callbacks, for the account's answer and for changes sent later.
  useEffect(() => {
    latest.current = options;
  });
  // The account's copy has been read for this account and collection, so changes may be sent.
  const ready = useRef<string | null>(null);
  const collection = options.collection.trim().toLowerCase();
  const scope = client ? `${client.account}:${collection}` : null;

  const send = (items: T[]) => {
    const { kind, serialize, storage } = latest.current;
    if (!client) return;
    const key = syncMarkerKey(client.account, kind, collection);
    const marker = readMarker(storage, key) ?? { updatedAt: null, dirty: false };
    writeMarker(storage, key, { ...marker, dirty: true });
    client
      .save(collection, kind, serialize(items))
      .then((updatedAt) => writeMarker(storage, key, { updatedAt, dirty: false }))
      .catch(() => undefined); // Kept as unsent; the next visit sends it.
  };

  useEffect(() => {
    if (!client || !scope || !collection) return;
    let cancelled = false;
    ready.current = null;
    const { kind, storage } = latest.current;
    const key = syncMarkerKey(client.account, kind, collection);
    client
      .load(collection)
      .then((saved) => {
        if (cancelled) return;
        const { items, apply, parse, serialize, union } = latest.current;
        const remote = saved[kind];
        const remoteItems = remote ? parse(remote.data) : [];
        const marker = readMarker(storage, key);
        let next: T[];
        if (!marker || marker.dirty) next = union(items, remoteItems);
        else if (remote && remote.updatedAt !== marker.updatedAt) next = remoteItems;
        else next = items;
        if (serialize(next) !== serialize(items)) apply(next);
        ready.current = scope;
        const nextText = serialize(next);
        if (nextText !== (remote?.data ?? serialize([]))) send(next);
        else writeMarker(storage, key, { updatedAt: remote?.updatedAt ?? null, dirty: false });
      })
      .catch(() => {
        // Offline or not available: this browser's copy stays, and changes are marked unsent.
      });
    return () => {
      cancelled = true;
    };
    // Runs when the account or the collection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  return {
    /** Sends a change, or marks it unsent until the account's copy has been read. */
    push(items: T[]) {
      if (!client || !scope) return;
      if (ready.current === scope) {
        send(items);
        return;
      }
      const { kind, storage } = latest.current;
      const key = syncMarkerKey(client.account, kind, collection);
      const marker = readMarker(storage, key) ?? { updatedAt: null, dirty: false };
      writeMarker(storage, key, { ...marker, dirty: true });
    },
  };
}
