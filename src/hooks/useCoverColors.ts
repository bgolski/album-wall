import { useEffect, useMemo, useRef, useState } from "react";
import type { Album } from "@/types";
import type { CoverColor } from "@/utils/colorBasics";
import type { CoverProfile } from "@/utils/coverProfile";
import { loadProfileCache, saveProfileCache } from "@/utils/colorCache";
import { readCoverProfile } from "@/utils/readCoverProfile";
import { fetchSharedProfiles, profileServiceUrl } from "@/utils/sharedProfiles";

interface CoverColorOptions {
  /** Measures one cover; replaceable for tests. */
  read?: (coverUrl: string) => Promise<CoverProfile | null>;
  /** Where colors are remembered between visits; `null` for nowhere, omitted for the browser's. */
  storage?: (Pick<Storage, "getItem" | "setItem"> & Partial<Pick<Storage, "removeItem">>) | null;
  /** How many covers are measured at once. */
  concurrency?: number;
  /**
   * Asks for profiles measured by other visitors before measuring here; `null` for never. By
   * default the app's cover color service, when it has one.
   */
  shared?: ((urls: string[], signal: AbortSignal) => Promise<Map<string, CoverProfile>>) | null;
}

const coverUrlOf = (album: Album) => album.cover_image || album.coverUrl || "";

function defaultStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// Measurements run when the browser is idle, so they never get in the way of drawing the wall.
function whenIdle(task: () => void) {
  if (typeof requestIdleCallback === "function") requestIdleCallback(task, { timeout: 500 });
  else setTimeout(task, 0);
}

/**
 * Works out each cover's profile (most noticeable color, palette and region colors), a few at a time, once something asks for them. Colors already
 * known (shipped with the album, or remembered from an earlier visit) are used without any
 * request. A cover that cannot be read gets `null` for this visit only and is tried again next
 * time.
 *
 * @param albums Albums whose covers to measure.
 * @param enabled Nothing is measured, and no storage is read, until this is true.
 * @param options Replacements for the reader, storage and number of covers measured at once.
 * @returns `colors` (each cover's most noticeable color) and `profiles`, both keyed by album id (a
 *          missing key means not measured yet), how many distinct
 *          covers are still waiting (`pending`) and how many distinct covers there are (`total`),
 *          so progress can be shown as `total - pending` of `total`.
 */
export function useCoverColors(albums: Album[], enabled: boolean, options: CoverColorOptions = {}) {
  const {
    read = readCoverProfile,
    storage,
    concurrency = 4,
    shared = profileServiceUrl
      ? (urls: string[], signal: AbortSignal) => fetchSharedProfiles(urls, { signal })
      : null,
  } = options;
  const [measured, setMeasured] = useState<ReadonlyMap<string, CoverProfile | null>>(new Map());
  // The same results as `measured`, for the measuring loop to consult without waiting for a render.
  const results = useRef(new Map<string, CoverProfile | null>());

  // The covers that need measuring: distinct, and without a color shipped with the album. Compared
  // as text so that merely reordering the albums does not start the work again.
  const toMeasure = useMemo(
    () =>
      [
        ...new Set(
          albums
            .filter((album) => !album.profile)
            .map(coverUrlOf)
            .filter(Boolean)
        ),
      ]
        .sort()
        .join("\n"),
    [albums]
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const asking = new AbortController();
    let active = 0;
    let sinceSave = 0;
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    let queue: string[] = [];
    const store = storage === undefined ? defaultStorage() : storage;
    let remembered = new Map<string, CoverProfile>();

    const flush = () => {
      flushTimer = undefined;
      if (!cancelled) setMeasured(new Map(results.current));
    };
    const persist = () => {
      if (!store) return;
      const merged = new Map(remembered);
      for (const [url, profile] of results.current) if (profile) merged.set(url, profile);
      saveProfileCache(store, merged);
    };
    const next = () => {
      while (!cancelled && active < concurrency && queue.length > 0) {
        const url = queue.shift()!;
        active += 1;
        whenIdle(() => {
          if (cancelled) return;
          read(url)
            .catch(() => null)
            .then((profile) => {
              results.current.set(url, profile);
              active -= 1;
              sinceSave += 1;
              if (queue.length === 0 && active === 0) persist();
              else if (sinceSave >= 24) {
                sinceSave = 0;
                persist();
              }
              flushTimer ??= setTimeout(flush, 50);
              next();
            });
        });
      }
    };

    // Start on an idle tick: read what is remembered, then measure only what is left.
    whenIdle(() => {
      if (cancelled) return;
      remembered = store ? loadProfileCache(store) : new Map();
      const wanted = toMeasure ? toMeasure.split("\n") : [];
      for (const url of wanted) {
        const known = remembered.get(url);
        if (known && !results.current.has(url)) results.current.set(url, known);
      }
      queue = wanted.filter((url) => !results.current.has(url));
      setMeasured(new Map(results.current));
      if (!shared || queue.length === 0) {
        next();
        return;
      }
      // Other visitors may already have measured these covers: take what they have, then measure
      // only the rest here. If the service is slow or down, everything is measured here as before.
      shared(queue, asking.signal)
        .catch(() => new Map<string, CoverProfile>())
        .then((found) => {
          if (cancelled) return;
          for (const [url, profile] of found) results.current.set(url, profile);
          queue = queue.filter((url) => !results.current.has(url));
          setMeasured(new Map(results.current));
          if (queue.length === 0) persist();
          next();
        });
    });

    return () => {
      cancelled = true;
      asking.abort();
      if (flushTimer) clearTimeout(flushTimer);
    };
  }, [enabled, toMeasure, read, storage, concurrency, shared]);

  return useMemo(() => {
    const colors: Record<string, CoverColor | null> = {};
    const profiles: Record<string, CoverProfile | null> = {};
    const waiting = new Set<string>();
    const covers = new Set<string>();
    for (const album of albums) {
      const url = coverUrlOf(album);
      if (url) covers.add(url);
      const profile = album.profile ?? (measured.has(url) ? measured.get(url) : undefined);
      if (profile !== undefined) {
        profiles[String(album.id)] = profile;
        colors[String(album.id)] = profile ? profile.color : null;
      } else if (enabled && url) waiting.add(url);
    }
    return { colors, profiles, pending: waiting.size, total: covers.size };
  }, [albums, enabled, measured]);
}
