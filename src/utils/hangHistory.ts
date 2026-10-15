import type { Album } from "@/types";

/** One wall the user hung: the day, and the albums on it in wall order. */
export interface HangRecord {
  /** Day it was hung, `YYYY-MM-DD` in the user's time zone. */
  date: string;
  albumIds: string[];
  /** The saved layout that was marked as on the wall, when it was one. */
  layoutId?: string;
}

/** Most walls remembered per collection; the oldest are forgotten first. */
export const MAX_HANGS = 50;
// A cover on the most recent wall costs this much more when building a wall that prefers rested
// covers; each older wall halves it.
const RECENT_COST = 0.08;

/**
 * Storage key for a collection's wall history.
 *
 * @param collectionName Collection the history belongs to.
 * @returns The key.
 */
export function hangHistoryKey(collectionName: string): string {
  return `album-wall:hang-history:${collectionName.trim().toLowerCase()}`;
}

/**
 * Whether a value is a well-formed hang record.
 *
 * @param value Anything.
 * @returns True for a record with a `YYYY-MM-DD` date and a list of id strings.
 */
export function isHangRecord(value: unknown): value is HangRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Partial<HangRecord>;
  return (
    typeof record.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(record.date) &&
    Array.isArray(record.albumIds) &&
    record.albumIds.every((id) => typeof id === "string") &&
    (record.layoutId === undefined || typeof record.layoutId === "string")
  );
}

/**
 * Reads stored history; anything damaged reads as no history.
 *
 * @param raw Stored text, or null.
 * @returns Records, oldest first.
 */
export function parseHangs(raw: string | null): HangRecord[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { v?: unknown; hangs?: unknown };
    if (parsed.v !== 1 || !Array.isArray(parsed.hangs)) return [];
    return parsed.hangs.filter(isHangRecord);
  } catch {
    return [];
  }
}

/**
 * Text to store for the history.
 *
 * @param hangs Records, oldest first.
 * @returns JSON text.
 */
export function serializeHangs(hangs: HangRecord[]): string {
  return JSON.stringify({ v: 1, hangs });
}

/**
 * The user's local day as `YYYY-MM-DD`.
 *
 * @param now The moment.
 * @returns The day.
 */
export function localDay(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Records a wall as hung today. Marking again on the same day replaces that day's record, so a
 * correction does not count twice. Only the most recent {@link MAX_HANGS} are kept.
 *
 * @param hangs Records, oldest first.
 * @param albumIds Albums on the wall, in order.
 * @param now The moment it was hung.
 * @param layoutId The saved layout marked as on the wall, if it was one.
 * @returns The new records, oldest first.
 */
export function addHang(
  hangs: HangRecord[],
  albumIds: string[],
  now: Date,
  layoutId?: string
): HangRecord[] {
  const date = localDay(now);
  const kept = hangs.filter((hang) => hang.date !== date);
  const record: HangRecord = { date, albumIds: [...albumIds] };
  if (layoutId) record.layoutId = layoutId;
  return [...kept, record].sort((x, y) => x.date.localeCompare(y.date)).slice(-MAX_HANGS);
}

/**
 * Adds records from a backup, keeping one record per day (the one already here wins).
 *
 * @param hangs Records here, oldest first.
 * @param incoming Records from the backup (damaged ones are ignored).
 * @returns The merged records, oldest first.
 */
export function mergeHangs(hangs: HangRecord[], incoming: unknown[]): HangRecord[] {
  const byDate = new Map(hangs.map((hang) => [hang.date, hang]));
  for (const record of incoming) {
    if (isHangRecord(record) && !byDate.has(record.date)) byDate.set(record.date, record);
  }
  return [...byDate.values()].sort((x, y) => x.date.localeCompare(y.date)).slice(-MAX_HANGS);
}

/**
 * When each album was last on a wall the user hung.
 *
 * @param hangs Records, oldest first.
 * @returns Album id to the last day it was hung.
 */
export function lastHung(hangs: HangRecord[]): Map<string, string> {
  const last = new Map<string, string>();
  for (const hang of hangs) for (const id of hang.albumIds) last.set(id, hang.date);
  return last;
}

/**
 * Albums in the order to offer when looking for records that have rested longest: never hung
 * first (in their usual order), then by the day they were last hung, oldest first.
 *
 * @param albums Albums in their usual order.
 * @param last Album id to the last day it was hung.
 * @returns The albums, reordered.
 */
export function orderByRest(albums: Album[], last: ReadonlyMap<string, string>): Album[] {
  return albums
    .map((album, index) => ({ album, index, day: last.get(String(album.id)) ?? "" }))
    .sort((x, y) => x.day.localeCompare(y.day) || x.index - y.index)
    .map(({ album }) => album);
}

/**
 * How much more each recently hung album costs when a wall should prefer rested records: most for
 * the latest wall, halving for each older one.
 *
 * @param hangs Records, oldest first.
 * @returns Album id to extra cost (albums not listed cost nothing extra).
 */
export function recentlyHungCost(hangs: HangRecord[]): Record<string, number> {
  const cost: Record<string, number> = {};
  hangs.forEach((hang, index) => {
    const age = hangs.length - 1 - index;
    for (const id of hang.albumIds) cost[id] = RECENT_COST * 0.5 ** age;
  });
  return cost;
}

/**
 * A day as people read it, such as "14 Oct 2026" (in the browser's language).
 *
 * @param day `YYYY-MM-DD`.
 * @returns The formatted day.
 */
export function formatDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(year!, (month ?? 1) - 1, date ?? 1)
  );
}
