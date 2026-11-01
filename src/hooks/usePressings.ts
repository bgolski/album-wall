import { useMemo, useState } from "react";
import type { Album } from "@/types";
import { albumKey } from "@/utils/albumKey";
import { pressingKey, showEachAlbumOnce } from "@/utils/groupPressings";
import { localStore } from "@/utils/browserStorage";

type PressingStorage = Pick<Storage, "getItem" | "setItem">;
interface Settings {
  once: boolean;
  chosen: Record<string, string>;
}

// Each album shows once unless the person turned that off for the collection.
const DEFAULT: Settings = { once: true, chosen: {} };

function readSettings(storage: PressingStorage | null, key: string): Settings {
  try {
    const parsed = JSON.parse(storage?.getItem(key) ?? "null") as Partial<Settings> | null;
    if (!parsed || typeof parsed.once !== "boolean") return DEFAULT;
    const chosen =
      typeof parsed.chosen === "object" && parsed.chosen !== null
        ? (parsed.chosen as Record<string, string>)
        : {};
    return { once: parsed.once, chosen };
  } catch {
    return DEFAULT;
  }
}

/**
 * "Show each album once" for a collection: on unless turned off. When on, the albums shown leave out extra pressings of
 * the same album (kept at the end of the collection, out of view), and a reorder of what is shown
 * keeps them. Turning it off, and which pressing stands for each album, are remembered per collection.
 *
 * @param albums The whole collection in its current order.
 * @param options Replacement storage, for tests.
 * @returns What to show, what is set aside, the sets of pressings, and the actions.
 */
export function usePressings(
  collectionName: string,
  albums: Album[],
  options: { storage?: PressingStorage | null } = {}
) {
  const storage = options.storage === undefined ? localStore() : options.storage;
  const key = `album-wall:pressings:${collectionName.trim().toLowerCase()}`;
  const [state, setState] = useState(() => ({ key, settings: readSettings(storage, key) }));
  const settings = state.key === key ? state.settings : readSettings(storage, key);

  const save = (next: Settings) => {
    try {
      storage?.setItem(key, JSON.stringify(next));
    } catch {
      // Not remembered; the choice still applies for this visit.
    }
    setState({ key, settings: next });
  };

  const grouped = useMemo(
    () => showEachAlbumOnce(albums, settings.chosen),
    [albums, settings.chosen]
  );
  const { shown, hidden } = settings.once ? grouped : { shown: albums, hidden: [] as Album[] };

  /** The other pressings of an album, in collection order. */
  const otherPressings = (album: Album): Album[] =>
    grouped.groups
      .find((set) => set.some((item) => item.id === album.id))
      ?.filter((item) => item.id !== album.id) ?? [];

  return {
    once: settings.once,
    shown,
    hidden,
    groups: grouped.groups,
    setOnce: (once: boolean) => save({ ...settings, once }),
    /** Shows `album` instead of the pressing standing for it now. */
    choose: (album: Album) =>
      save({ ...settings, chosen: { ...settings.chosen, [pressingKey(album)]: albumKey(album) } }),
    otherPressings,
    /** Keeps the albums set aside at the end when what is shown is reordered. */
    withHidden: (next: Album[]) => [...next, ...hidden],
  };
}
