import { isCoverColor, type CoverColor } from "./colorBasics";
import type { CoverProfile } from "./coverProfile";

const round = (value: number) => Math.round(value * 10000) / 10000;
const roundColor = (color: CoverColor): CoverColor => ({
  l: round(color.l),
  a: round(color.a),
  b: round(color.b),
});

/**
 * Whether a value is a usable cover profile: a color, a palette of colors with shares between 0
 * and 1, and nine regions that are colors or `null`.
 *
 * @param value Value to check.
 * @returns `true` for a profile.
 */
export function isCoverProfile(value: unknown): value is CoverProfile {
  if (typeof value !== "object" || value === null) return false;
  const profile = value as Record<string, unknown>;
  return (
    isCoverColor(profile.color) &&
    Array.isArray(profile.palette) &&
    profile.palette.length > 0 &&
    profile.palette.every(
      (entry: unknown) =>
        typeof entry === "object" &&
        entry !== null &&
        isCoverColor((entry as { color?: unknown }).color) &&
        typeof (entry as { share?: unknown }).share === "number" &&
        (entry as { share: number }).share >= 0 &&
        (entry as { share: number }).share <= 1
    ) &&
    Array.isArray(profile.regions) &&
    profile.regions.length === 9 &&
    profile.regions.every((region: unknown) => region === null || isCoverColor(region))
  );
}

/**
 * The same profile with every number rounded to four decimals, for storing.
 *
 * @param profile Profile to round.
 * @returns A rounded copy.
 */
export function roundProfile(profile: CoverProfile): CoverProfile {
  return {
    color: roundColor(profile.color),
    palette: profile.palette.map((entry) => ({
      color: roundColor(entry.color),
      share: entry.share,
    })),
    regions: profile.regions.map((region) => (region ? roundColor(region) : null)),
  };
}
