import type { SharedWallState } from "@/types";

/** Maximum number of saved layouts a collection may keep. */
export const MAX_LAYOUTS = 20;

/** Shape of a single saved wall snapshot. */
export type SavedLayout = {
  v: 1;
  id: string;
  name: string;
  savedAt: string;
  wall: SharedWallState;
};

/** Error thrown by layout-store operations. */
export class LayoutError extends Error {
  code: "empty-name" | "limit" | "invalid-file";

  constructor(code: "empty-name" | "limit" | "invalid-file", message: string) {
    super(message);
    this.name = "LayoutError";
    this.code = code;
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Compute the localStorage key used for a collection's layout store.
 */
export function layoutsKey(collectionName: string): string {
  return "album-wall:layouts:" + collectionName.trim().toLowerCase();
}

/**
 * Guarantee that *name* is unique inside *list* by appending
 * `" 2"`, `" 3"`, … until no case-insensitive match remains.
 * A layout that owns the name already is never treated as a
 * collision with itself.
 */
function makeUniqueName(name: string, list: SavedLayout[], ownId?: string): string {
  const used = new Set(list.filter((l) => l.id !== ownId).map((l) => l.name.toLowerCase()));
  let candidate = name;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = name + " " + n;
    n++;
  }
  return candidate;
}

/**
 * Validate that a single SavedLayout entry is structurally sound.
 */
function isSavedLayout(value: unknown): value is SavedLayout {
  if (value == null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.v !== 1) return false;
  if (typeof v.id !== "string" || v.id === "") return false;
  if (typeof v.name !== "string" || v.name === "") return false;
  if (typeof v.savedAt !== "string") return false;

  const wall = v.wall;
  if (wall == null || typeof wall !== "object") return false;
  const w = wall as Record<string, unknown>;
  if (w.v !== 1) return false;
  if (typeof w.username !== "string") return false;
  // A wall needs at least one row and one column, or positions on it cannot be worked out.
  if (!Number.isInteger(w.rows) || (w.rows as number) < 1) return false;
  if (!Number.isInteger(w.columns) || (w.columns as number) < 1) return false;
  if (
    !Array.isArray(w.wallAlbumIds) ||
    !w.wallAlbumIds.every((x: unknown) => typeof x === "string")
  )
    return false;
  if (
    !Array.isArray(w.pinnedAlbumIds) ||
    !w.pinnedAlbumIds.every((x: unknown) => typeof x === "string")
  )
    return false;

  return true;
}

/* ------------------------------------------------------------------ */
/*  Persistence serialisers                                            */
/* ------------------------------------------------------------------ */

/**
 * Combines this browser's layouts with another copy (the account's) so none is lost: one of each
 * id (the more recently saved), this browser's first, then the others; at most
 * {@link MAX_LAYOUTS}, dropping the oldest.
 *
 * @param local This browser's layouts.
 * @param other The other copy.
 * @returns The combined layouts.
 */
export function unionLayouts(local: SavedLayout[], other: SavedLayout[]): SavedLayout[] {
  const byId = new Map(local.map((layout) => [layout.id, layout]));
  for (const layout of other) {
    const here = byId.get(layout.id);
    if (!here || layout.savedAt > here.savedAt) byId.set(layout.id, layout);
  }
  const combined = [...byId.values()];
  if (combined.length <= MAX_LAYOUTS) return combined;
  const keep = new Set(
    [...combined]
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
      .slice(0, MAX_LAYOUTS)
      .map((layout) => layout.id)
  );
  return combined.filter((layout) => keep.has(layout.id));
}

/** Serialize a list of layouts into a JSON string for localStorage. */
export function serializeLayouts(layouts: SavedLayout[]): string {
  return JSON.stringify({ v: 1, layouts });
}

/**
 * Parse a serialized layout blob.
 * Returns `[]` for null, bad JSON, wrong schema version, or
 * non-matching top-level shape. Damaged entries and repeated ids
 * (the first one wins) inside a valid wrapper are silently dropped.
 */
export function parseLayouts(raw: string | null): SavedLayout[] {
  if (raw == null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (typeof parsed !== "object" || parsed == null) return [];
  const obj = parsed as Record<string, unknown>;
  if (obj.v !== 1 || !Array.isArray(obj.layouts)) return [];
  const seen = new Set<string>();
  return obj.layouts.filter((entry): entry is SavedLayout => {
    if (!isSavedLayout(entry) || seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                          */
/* ------------------------------------------------------------------ */

/**
 * Append a new layout. Trims and deduplicates the name.
 * Throws `LayoutError("empty-name")` or `LayoutError("limit")`.
 */
export function addLayout(
  layouts: SavedLayout[],
  name: string,
  wall: SharedWallState,
  now: Date,
  id: string
): SavedLayout[] {
  const trimmed = name.trim();
  if (trimmed === "") {
    throw new LayoutError("empty-name", "Layout name must not be empty.");
  }
  if (layouts.length >= MAX_LAYOUTS) {
    throw new LayoutError("limit", "Maximum number of layouts reached.");
  }
  const unique = makeUniqueName(trimmed, layouts);
  return [...layouts, { v: 1, id, name: unique, savedAt: now.toISOString(), wall }];
}

/**
 * Rename the layout identified by *id*. Trims and deduplicates the
 * new name. Returns the array unchanged for an unknown id.
 * Throws `LayoutError("empty-name")` for a blank name.
 */
export function renameLayout(layouts: SavedLayout[], id: string, name: string): SavedLayout[] {
  const trimmed = name.trim();
  if (trimmed === "") {
    throw new LayoutError("empty-name", "Layout name must not be empty.");
  }
  const idx = layouts.findIndex((l) => l.id === id);
  if (idx === -1) return layouts;
  return layouts.map((l, i) =>
    i === idx ? { ...l, name: makeUniqueName(trimmed, layouts, id) } : l
  );
}

/**
 * Remove the layout identified by *id*. Returns the array unchanged
 * for an unknown id.
 */
export function deleteLayout(layouts: SavedLayout[], id: string): SavedLayout[] {
  const idx = layouts.findIndex((l) => l.id === id);
  if (idx === -1) return layouts;
  return [...layouts.slice(0, idx), ...layouts.slice(idx + 1)];
}

/* ------------------------------------------------------------------ */
/*  Import / export bundle                                             */
/* ------------------------------------------------------------------ */

/** Create a portable JSON bundle string for all layouts, and the wall history when there is one. */
export function exportBundle(layouts: SavedLayout[], hangs: unknown[] = []): string {
  return JSON.stringify({
    app: "album-wall",
    kind: "layouts",
    v: 1,
    layouts,
    ...(hangs.length > 0 ? { hangs } : {}),
  });
}

/**
 * Import a bundle. Damaged entries and duplicate ids are skipped.
 * Stops at `MAX_LAYOUTS`; excess entries count as skipped.
 */
export function importBundle(
  existing: SavedLayout[],
  raw: string
): { layouts: SavedLayout[]; added: number; skipped: number; hangs: unknown[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new LayoutError("invalid-file", "Import text is not valid JSON.");
  }
  if (typeof parsed !== "object" || parsed == null) {
    throw new LayoutError("invalid-file", "Import root is not an object.");
  }
  const obj = parsed as Record<string, unknown>;
  if (
    obj.app !== "album-wall" ||
    obj.kind !== "layouts" ||
    obj.v !== 1 ||
    !Array.isArray(obj.layouts)
  ) {
    throw new LayoutError("invalid-file", "Import is not a valid album-wall layouts bundle.");
  }

  let layouts = [...existing];
  let added = 0;
  let skipped = 0;

  for (const entry of obj.layouts) {
    if (!isSavedLayout(entry)) {
      skipped++;
      continue;
    }
    if (layouts.some((l) => l.id === entry.id)) {
      skipped++;
      continue;
    }
    if (layouts.length >= MAX_LAYOUTS) {
      skipped++;
      continue;
    }
    const unique = makeUniqueName(entry.name, layouts);
    layouts = [...layouts, { ...entry, name: unique }];
    added++;
  }

  return { layouts, added, skipped, hangs: Array.isArray(obj.hangs) ? obj.hangs : [] };
}
