import type { CoverColor } from "./colorBasics";
import { srgbToOklab } from "./coverColor";

/** One step in a gradient: a {@link CoverColor} pinned at a 0-to-1 position `at`. */
export interface GradientStop {
  color: CoverColor;
  at: number;
}

/** Shape of the gradient: linear (straight, with CSS-style `angle`) or radial (center-out). */
export type GradientShape = { kind: "linear"; angle: number } | { kind: "radial" };

/**
 * Assign a color to every wall position from a gradient defined by `stops`.
 *
 * The wall is treated as a grid of `rows` by `columns` one-unit squares.
 * Positions are returned in row-major order (`rows * columns` entries).
 *
 * @param stops Gradient stops (sorted internally).
 * @param shape Linear or radial gradient shape.
 * @returns One CoverColor per position, or `[]` when `stops` is empty.
 */
export function gradientTargets(
  stops: GradientStop[],
  rows: number,
  columns: number,
  shape: GradientShape
): CoverColor[] {
  const count = rows * columns;
  if (stops.length === 0) return [];

  // Sort a copy by `at` ascending; ties keep the later (larger) at.
  const sorted = [...stops].sort((a, b) => a.at - b.at);

  if (sorted.length === 1) {
    return Array.from({ length: count }, () => sorted[0]!.color);
  }

  // Compute raw values for every cell.
  const raws: number[] = Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / columns);
    const col = i % columns;
    const x = col + 0.5;
    const y = row + 0.5;

    if (shape.kind === "linear") {
      const a = (shape.angle * Math.PI) / 180;
      const dx = Math.sin(a);
      const dy = -Math.cos(a);
      return (x - columns / 2) * dx + (y - rows / 2) * dy;
    }
    return Math.hypot(x - columns / 2, y - rows / 2);
  });

  // Normalise to [0, 1].
  const minRaw = Math.min(...raws);
  const maxRaw = Math.max(...raws);
  const range = maxRaw - minRaw;
  const ts: number[] =
    range < 1e-9 ? Array.from({ length: count }, () => 0) : raws.map((r) => (r - minRaw) / range);

  return ts.map((t) => colorAt(sorted, t));
}

/**
 * Find the color at position `t` (0..1) along a sorted stop list.
 *
 * Before the first stop returns the first color; after the last, the last color.
 * Between two stops linearly blends l, a, b.  Stops sharing the same `at` use the
 * later one's color.
 */
function colorAt(stops: GradientStop[], t: number): CoverColor {
  // Find the rightmost stop whose `at` <= t.
  let idx = -1;
  for (let i = 0; i < stops.length; i += 1) {
    if (stops[i]!.at <= t) idx = i;
    else break;
  }

  if (idx < 0) return stops[0]!.color;
  if (idx >= stops.length - 1) return stops[stops.length - 1]!.color;

  const nextIdx = idx + 1;
  const at0 = stops[idx]!.at;
  if (nextIdx >= stops.length || t < at0) return stops[idx]!.color;

  // Blend with the next stop.
  const at1 = stops[nextIdx]!.at;
  if (at1 - at0 < 1e-12) return stops[nextIdx]!.color;
  const f = (t - at0) / (at1 - at0);

  const c0 = stops[idx]!.color;
  const c1 = stops[nextIdx]!.color;
  return {
    l: c0.l + (c1.l - c0.l) * f,
    a: c0.a + (c1.a - c0.a) * f,
    b: c0.b + (c1.b - c0.b) * f,
  };
}

/**
 * Parse an `#rgb` or `#rrggbb` string into a {@link CoverColor}.
 *
 * @returns The color in OKLab, or `null` for an unparseable string.
 */
export function hexToOklab(hex: string): CoverColor | null {
  if (typeof hex !== "string") return null;

  let s: string;
  if (hex.length === 4) {
    // #rgb — every char must be a hex digit
    if (!/^#[0-9a-fA-F]{3}$/.test(hex)) return null;
    s = "#" + hex[1]! + hex[1] + hex[2]! + hex[2] + hex[3]! + hex[3];
  } else if (hex.length === 7) {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
    s = hex;
  } else {
    return null;
  }

  const r = parseInt(s.substring(1, 3), 16);
  const g = parseInt(s.substring(3, 5), 16);
  const b = parseInt(s.substring(5, 7), 16);
  return srgbToOklab(r, g, b);
}

/**
 * Convert an OKLab color back to lowercase `#rrggbb`.
 *
 * Steps: OKLab → lms intermediate → linear sRGB → clamped/scaled sRGB → hex.
 * Channels outside 0..1 are clamped to 0 or 1 before the gamma curve.
 *
 * @returns Six-digit lowercase hex string.
 */
export function oklabToHex(color: CoverColor): string {
  const L = color.l;
  const a = color.a;
  const b = color.b;

  // OKLab → lms_ (cube root stage intermediate)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  // Cube
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  // LMS → linear sRGB
  const rLinear = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gLinear = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLinear = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  // Clamp, apply sRGB gamma, convert to 0-255
  const clamp = (c: number): number => {
    const v = c < 0 ? 0 : c > 1 ? 1 : c;
    return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  };

  const toByte = (c: number): number => Math.round(clamp(c) * 255);

  return (
    "#" +
    toByte(rLinear).toString(16).padStart(2, "0") +
    toByte(gLinear).toString(16).padStart(2, "0") +
    toByte(bLinear).toString(16).padStart(2, "0")
  );
}
