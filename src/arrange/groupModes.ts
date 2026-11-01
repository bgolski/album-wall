import type { Album } from "@/types/index";

/** The ways to build a wall from groups of records, besides by color. */
export type GroupMode = "artist" | "genre" | "year";

/** What a tap asks for: which groups, in what order, or the whole collection by artist A to Z. */
export interface GroupSettings {
  mode: GroupMode;
  /** Group names in the order they should run along the wall. */
  groups: string[];
  /** Sort the whole collection by artist and show the first wall's worth. */
  aToZ: boolean;
}

export interface GroupChoice {
  label: string;
  count: number;
}

const MIN_YEAR = 1000;

function yearOf(album: Album): number | null {
  const year = Number.parseInt(album.year ?? "", 10);
  return Number.isFinite(year) && year >= MIN_YEAR ? year : null;
}

function genresOf(album: Album): string[] {
  const genre: unknown = album.genre;
  return typeof genre === "string" ? [genre] : (album.genre ?? []);
}

/**
 * The groups a record belongs to under a mode: its artist, its genres and styles, or its decade.
 *
 * @returns Group names; empty when the record has none (no year, say).
 */
export function groupsOf(mode: GroupMode, album: Album): string[] {
  if (mode === "artist") return album.artist?.trim() ? [album.artist.trim()] : [];
  if (mode === "genre") {
    return Array.from(new Set([...genresOf(album), ...(album.styles ?? [])].filter(Boolean)));
  }
  const year = yearOf(album);
  return year === null ? [] : [`${Math.floor(year / 10) * 10}s`];
}

/**
 * Every group in the collection with how many records it holds: biggest first, except decades,
 * which run oldest to newest.
 */
export function availableGroups(mode: GroupMode, albums: Album[]): GroupChoice[] {
  const counts = new Map<string, number>();
  for (const album of albums) {
    for (const label of groupsOf(mode, album)) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const choices = Array.from(counts, ([label, count]) => ({ label, count }));
  return mode === "year"
    ? choices.sort((a, b) => a.label.localeCompare(b.label))
    : choices.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function titleOf(album: Album) {
  return album.title ?? "";
}

/**
 * Turns a tap's choices into which records to use and how to order them along the wall.
 *
 * @returns A selection, a comparison, and whether to take only the first records of the run.
 */
export function groupPlan(settings: GroupSettings): {
  select: (album: Album) => boolean;
  compare: (first: Album, second: Album) => number;
  firstOnly: boolean;
} {
  const { mode } = settings;
  if (settings.aToZ) {
    return {
      select: () => true,
      compare: (a, b) =>
        (a.artist ?? "").localeCompare(b.artist ?? "") || titleOf(a).localeCompare(titleOf(b)),
      firstOnly: true,
    };
  }
  const order = new Map(settings.groups.map((label, index) => [label, index]));
  const indexOf = (album: Album) => {
    const found = groupsOf(mode, album)
      .map((label) => order.get(label))
      .filter((index): index is number => index !== undefined);
    return found.length === 0 ? -1 : Math.min(...found);
  };
  // Within a group: oldest first for years, by artist otherwise.
  const within = (a: Album, b: Album) =>
    mode === "year" && (yearOf(a) ?? Infinity) !== (yearOf(b) ?? Infinity)
      ? (yearOf(a) ?? Infinity) - (yearOf(b) ?? Infinity)
      : (a.artist ?? "").localeCompare(b.artist ?? "") || titleOf(a).localeCompare(titleOf(b));
  return {
    select: (album) => indexOf(album) >= 0,
    compare: (a, b) => indexOf(a) - indexOf(b) || within(a, b),
    firstOnly: false,
  };
}
