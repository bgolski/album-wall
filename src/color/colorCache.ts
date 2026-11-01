import type { CoverColor } from "./colorBasics";
import { mostNoticeableColor, type CoverProfile } from "./coverProfile";
import { isCoverProfile, roundProfile } from "./profileShape";

/** Storage key for the cover profiles measured in this browser. */
export const PROFILE_CACHE_KEY = "album-wall:cover-profiles";

/** Format of the stored profiles; version 2 caches are still read (see {@link loadProfileCache}). */
const CACHE_VERSION = 3;

/** Where the single average colors of earlier versions were kept; cleared when profiles are saved. */
const OLD_COLOR_KEY = "album-wall:cover-colors";

/** Most covers remembered (a profile is a few hundred bytes); the oldest are forgotten first. */
export const MAX_CACHED_PROFILES = 2000;

/** A profile in a compact form for storing: color, palette entries (with share) and regions as arrays. */
export type PackedProfile = { c: number[]; p: number[][]; r: (number[] | null)[] };

const pack = (color: CoverColor) => [color.l, color.a, color.b];
const unpack = (numbers: unknown): CoverColor | null =>
  Array.isArray(numbers) && numbers.length >= 3
    ? { l: numbers[0], a: numbers[1], b: numbers[2] }
    : null;

/**
 * Packs a profile into its compact stored form, rounded to four decimals.
 */
export function packProfile(profile: CoverProfile): PackedProfile {
  const rounded = roundProfile(profile);
  return {
    c: pack(rounded.color),
    p: rounded.palette.map((entry) => [...pack(entry.color), entry.share]),
    r: rounded.regions.map((region) => (region ? pack(region) : null)),
  };
}

/**
 * Reads a profile back from its compact stored form.
 *
 * @param value A value that should be a packed profile.
 * @returns The profile, or `null` when the value is not a usable one.
 */
export function unpackProfile(value: unknown): CoverProfile | null {
  if (typeof value !== "object" || value === null) return null;
  const packed = value as Partial<PackedProfile>;
  if (!Array.isArray(packed.p) || !Array.isArray(packed.r)) return null;
  const profile = {
    color: unpack(packed.c),
    palette: packed.p.map((entry) => ({ color: unpack(entry), share: entry?.[3] })),
    regions: packed.r.map((region) => (region === null ? null : unpack(region))),
  };
  return isCoverProfile(profile) ? profile : null;
}

/**
 * Reads the remembered cover profiles.
 *
 * @param storage Picked from the Web Storage API, only `getItem` is needed.
 * @returns Cover address to profile, oldest first; empty when nothing usable is stored.
 */
export function loadProfileCache(storage: Pick<Storage, "getItem">): Map<string, CoverProfile> {
  const profiles = new Map<string, CoverProfile>();
  try {
    const parsed: unknown = JSON.parse(storage.getItem(PROFILE_CACHE_KEY) ?? "null");
    if (typeof parsed !== "object" || parsed === null) return profiles;
    const stored = parsed as { v?: unknown; covers?: unknown };
    if (
      (stored.v !== 2 && stored.v !== CACHE_VERSION) ||
      typeof stored.covers !== "object" ||
      stored.covers === null
    )
      return profiles;
    for (const [url, value] of Object.entries(stored.covers as Record<string, unknown>)) {
      const profile = unpackProfile(value);
      if (!profile) continue;
      // Version 2 chose the most noticeable color by an older rule; the palette it kept is enough
      // to choose again without reading the cover.
      if (stored.v === 2 && profile.palette.length > 0) {
        profile.color = mostNoticeableColor([...profile.palette].sort((x, y) => y.share - x.share));
      }
      profiles.set(url, profile);
    }
  } catch {
    // Blocked or damaged storage: start with nothing remembered.
  }
  return profiles;
}

/**
 * Remembers cover profiles, keeping at most `MAX_CACHED_PROFILES` (the newest), with numbers
 * rounded to four decimals, and clears the single colors earlier versions stored.
 *
 * @param storage Picked from the Web Storage API; `removeItem` is used when present.
 * @param profiles Cover address to profile, oldest first.
 * @returns `true` when stored, `false` when storage refused.
 */
export function saveProfileCache(
  storage: Pick<Storage, "setItem"> & Partial<Pick<Storage, "removeItem">>,
  profiles: Map<string, CoverProfile>
): boolean {
  try {
    const covers: Record<string, PackedProfile> = {};
    for (const [url, profile] of [...profiles].slice(-MAX_CACHED_PROFILES)) {
      covers[url] = packProfile(profile);
    }
    storage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ v: CACHE_VERSION, covers }));
    storage.removeItem?.(OLD_COLOR_KEY);
    return true;
  } catch {
    return false;
  }
}
