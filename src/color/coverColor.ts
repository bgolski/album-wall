import { CoverColor } from "./colorBasics";

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
