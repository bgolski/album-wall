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

/**
 * Convert an sRGB color (0-255) to the OKLab color space.
 *
 * @param r Red channel, 0-255.
 * @param g Green channel, 0-255.
 * @param b Blue channel, 0-255.
 * @returns The color in OKLab with components l, a, b.
 */
export function srgbToOklab(r: number, g: number, b: number): CoverColor {
  // linearize sRGB channels
  const lin = (c: number): number => {
    const t = c / 255;
    return t <= 0.04045 ? t / 12.92 : Math.pow((t + 0.055) / 1.055, 2.4);
  };
  const rL = lin(r);
  const gL = lin(g);
  const bL = lin(b);

  // sRGB to LMS
  const l = 0.4122214708 * rL + 0.5363325363 * gL + 0.0514459929 * bL;
  const m = 0.2119034982 * rL + 0.6806995451 * gL + 0.1073969566 * bL;
  const s = 0.0883024619 * rL + 0.2817188376 * gL + 0.6299787005 * bL;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    l: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}
