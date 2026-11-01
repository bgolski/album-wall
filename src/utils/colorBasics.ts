/** A color in OKLab: lightness `l` (0 to 1) and the green-red `a` and blue-yellow `b` axes. */
export interface CoverColor {
  l: number;
  a: number;
  b: number;
}

/**
 * Whether a value is a usable color: an object with finite `l`, `a` and `b` numbers.
 *
 * @returns `true` for a color.
 */
export function isCoverColor(value: unknown): value is CoverColor {
  if (typeof value !== "object" || value === null) return false;
  const color = value as Record<string, unknown>;
  return [color.l, color.a, color.b].every(
    (part) => typeof part === "number" && Number.isFinite(part)
  );
}

/** Chroma below this reads as grey, black or white rather than as a color. */
export const NEUTRAL_CHROMA = 0.04;

/**
 * How colorful a color is, as its distance from the grey axis.
 *
 * @returns Chroma, 0 for greys.
 */
export function chromaOf(color: CoverColor): number {
  return Math.hypot(color.a, color.b);
}

/**
 * The hue angle of a color.
 *
 * @returns Degrees from 0 up to (not including) 360.
 */
export function hueOf(color: CoverColor): number {
  const degrees = (Math.atan2(color.b, color.a) * 180) / Math.PI;
  return degrees < 0 ? degrees + 360 : degrees;
}

/**
 * How different two colors look, as their straight-line distance in OKLab.
 *
 * @returns Distance; 0 for equal colors.
 */
export function colorDistance(x: CoverColor, y: CoverColor): number {
  return Math.hypot(x.l - y.l, x.a - y.a, x.b - y.b);
}
