import { CoverColor, NEUTRAL_CHROMA, chromaOf } from "./colorBasics";
import { srgbToOklab } from "./coverColor";

/** A single entry in the palette. */
export interface PaletteEntry {
  color: CoverColor;
  share: number;
}

/** Color profile extracted from an album cover image. */
export interface CoverProfile {
  color: CoverColor;
  palette: PaletteEntry[];
  regions: (CoverColor | null)[];
}

/**
 * The color people notice first on a cover: among palette colors covering at least a tenth of it,
 * the biggest area weighted by how colorful it is. Chroma below {@link NEUTRAL_CHROMA} reads as
 * grey and only reflects lighting and compression, so every grey counts as that colorful: between
 * two grey areas size decides, instead of noise picking black on one photo of a cover and cream on
 * the next. Ties keep the bigger area.
 *
 * @param palette Palette entries, biggest share first; at least one.
 * @returns The chosen palette color.
 */
export function mostNoticeableColor(palette: readonly PaletteEntry[]): CoverColor {
  let color = palette[0]!.color;
  let bestScore = -1;
  for (const entry of palette) {
    if (entry.share < 0.1) continue;
    const score = entry.share * Math.max(chromaOf(entry.color), NEUTRAL_CHROMA);
    if (score > bestScore) {
      bestScore = score;
      color = entry.color;
    }
  }
  return color;
}

/** Squared Euclidean distance between two OKLab colours. */
function squaredDistance(a: CoverColor, b: CoverColor): number {
  const dL = a.l - b.l;
  const dA = a.a - b.a;
  const dB = a.b - b.b;
  return dL * dL + dA * dA + dB * dB;
}

/** Kept pixel with coordinates. */
interface KeptPixel {
  l: number;
  a: number;
  b: number;
  x: number;
  y: number;
}

/**
 * Extracts a color profile from an album cover image.
 *
 * Runs k-means clustering (k = 4) on opaque pixels in OKLab space,
 * returns the palette, the most noticeable palette colour, and a
 * 3 × 3 grid of per-region average colours.
 *
 * @param pixels RGBA data, row by row, four bytes per pixel.
 * @param width  Image width in pixels.
 * @param height Image height in pixels.
 * @returns The cover profile, or `null` when no opaque pixels are present.
 */
export function coverProfile(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): CoverProfile | null {
  // ---- 1. Kept pixels ----
  const kept: KeptPixel[] = [];
  const pixelsLength = pixels.length;
  for (let i = 0; i < pixelsLength; i += 4) {
    if (pixels[i + 3]! < 128) continue;
    const idx = i / 4;
    const pixel = srgbToOklab(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!);
    kept.push({
      l: pixel.l,
      a: pixel.a,
      b: pixel.b,
      x: idx % width,
      y: Math.floor(idx / width),
    });
  }

  if (kept.length === 0) return null;

  const n = kept.length;
  const firstCenter: CoverColor = kept[0]!;

  // ---- 2. K-means clustering, k = 4 ----
  const clusterL = [0, 0, 0, 0] as [number, number, number, number];
  const clusterA = [0, 0, 0, 0] as [number, number, number, number];
  const clusterB = [0, 0, 0, 0] as [number, number, number, number];
  const clusterCount = [0, 0, 0, 0] as [number, number, number, number];

  const initFractions: number[] = [0, 1 / 3, 2 / 3, 1];
  const centers: CoverColor[] = [
    { l: firstCenter.l, a: firstCenter.a, b: firstCenter.b },
    { l: firstCenter.l, a: firstCenter.a, b: firstCenter.b },
    { l: firstCenter.l, a: firstCenter.a, b: firstCenter.b },
    { l: firstCenter.l, a: firstCenter.a, b: firstCenter.b },
  ];
  for (let c = 0; c < 4; c += 1) {
    const ci = Math.floor(initFractions[c]! * (n - 1));
    centers[c] = { l: kept[ci]!.l, a: kept[ci]!.a, b: kept[ci]!.b };
  }

  const assignments: number[] = new Array(n);

  for (let iter = 0; iter < 12; iter += 1) {
    // Assign every kept pixel to the nearest centre.
    for (let i = 0; i < n; i += 1) {
      const p = kept[i]!;
      let best = 0;
      let bestDist = squaredDistance(p, centers[0]!);
      for (let c = 1; c < 4; c += 1) {
        const dist = squaredDistance(p, centers[c]!);
        if (dist < bestDist) {
          bestDist = dist;
          best = c;
        }
      }
      assignments[i] = best;
    }

    // Accumulate per-cluster using local variables to avoid compound writes.
    for (let c = 0; c < 4; c += 1) {
      clusterL[c] = 0;
      clusterA[c] = 0;
      clusterB[c] = 0;
      clusterCount[c] = 0;
    }
    for (let i = 0; i < n; i += 1) {
      const clusterIdx = assignments[i]!;
      clusterL[clusterIdx] = clusterL[clusterIdx]! + kept[i]!.l;
      clusterA[clusterIdx] = clusterA[clusterIdx]! + kept[i]!.a;
      clusterB[clusterIdx] = clusterB[clusterIdx]! + kept[i]!.b;
      clusterCount[clusterIdx] = clusterCount[clusterIdx]! + 1;
    }
    for (let c = 0; c < 4; c += 1) {
      const cnt = clusterCount[c]!;
      if (cnt > 0) {
        centers[c] = {
          l: clusterL[c]! / cnt,
          a: clusterA[c]! / cnt,
          b: clusterB[c]! / cnt,
        };
      }
    }
  }

  // Final assignment (no further moves).
  for (let i = 0; i < n; i += 1) {
    const p = kept[i]!;
    let best = 0;
    let bestDist = squaredDistance(p, centers[0]!);
    for (let c = 1; c < 4; c += 1) {
      const dist = squaredDistance(p, centers[c]!);
      if (dist < bestDist) {
        bestDist = dist;
        best = c;
      }
    }
    assignments[i] = best;
  }

  // Build palette: keep clusters with share >= 0.02.
  const paletteRaw: { color: CoverColor; share: number; clusterIndex: number }[] = [];
  for (let c = 0; c < 4; c += 1) {
    const share = clusterCount[c]! / n;
    if (share >= 0.02) {
      paletteRaw.push({
        color: centers[c]!,
        share: Math.round(share * 1000) / 1000,
        clusterIndex: c,
      });
    }
  }

  paletteRaw.sort((a, b) => {
    if (a.share !== b.share) return b.share - a.share;
    return a.clusterIndex - b.clusterIndex;
  });

  // ---- 3. colour (most noticeable) ----
  const color = mostNoticeableColor(paletteRaw);

  // ---- 4. regions: 3 x 3 grid in row-major order ----
  const regionL = new Float64Array(9);
  const regionA = new Float64Array(9);
  const regionB = new Float64Array(9);
  const regionCount = new Int32Array(9);

  for (let i = 0; i < n; i += 1) {
    const p = kept[i]!;
    const col = Math.min(2, ((p.x * 3) / width) | 0);
    const row = Math.min(2, ((p.y * 3) / height) | 0);
    const idx = row * 3 + col;
    const newCount = regionCount[idx]! + 1;
    regionCount[idx] = newCount;
    const newL = regionL[idx]! + p.l;
    regionL[idx] = newL;
    const newA = regionA[idx]! + p.a;
    regionA[idx] = newA;
    const newB = regionB[idx]! + p.b;
    regionB[idx] = newB;
  }

  const regions: (CoverColor | null)[] = [];
  for (let i = 0; i < 9; i += 1) {
    const count = regionCount[i]!;
    if (count === 0) {
      regions.push(null);
    } else {
      regions.push({
        l: regionL[i]! / count,
        a: regionA[i]! / count,
        b: regionB[i]! / count,
      });
    }
  }

  return {
    color,
    palette: paletteRaw.map((e) => ({ color: e.color, share: e.share })),
    regions,
  };
}
