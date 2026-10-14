import { describe, expect, it } from "vitest";
import type { CoverColor } from "./colorBasics";
import type { GradientStop } from "./gradientTargets";
import { regionFit, tileSamples } from "./gradientFit";

const start: CoverColor = { l: 0.25, a: 0.125, b: -0.125 };
const end: CoverColor = { l: 0.75, a: -0.125, b: 0.125 };
const stops: GradientStop[] = [
  { color: start, at: 0 },
  { color: end, at: 1 },
];
const blend = (t: number): CoverColor => ({
  l: start.l + (end.l - start.l) * t,
  a: start.a + (end.a - start.a) * t,
  b: start.b + (end.b - start.b) * t,
});
const near = (actual: CoverColor | undefined, expected: CoverColor) => {
  expect(actual!.l).toBeCloseTo(expected.l, 9);
  expect(actual!.a).toBeCloseTo(expected.a, 9);
  expect(actual!.b).toBeCloseTo(expected.b, 9);
};

describe("tileSamples", () => {
  it("samples 9 colors across each tile, so neighbouring tiles join up", () => {
    const tiles = tileSamples(stops, 1, 2, { kind: "linear", angle: 90 });
    expect(tiles).toHaveLength(2);
    expect(tiles[0]).toHaveLength(9);
    // Six fine columns across the wall: 0, 0.2, 0.4 in the first tile and 0.6, 0.8, 1 in the second.
    for (const row of [0, 1, 2]) {
      near(tiles[0]![row * 3], blend(0));
      near(tiles[0]![row * 3 + 2], blend(0.4));
      near(tiles[1]![row * 3], blend(0.6));
      near(tiles[1]![row * 3 + 2], blend(1));
    }
  });

  it("puts the first stop at the very center of the middle tile for a radial gradient", () => {
    const tiles = tileSamples(stops, 3, 3, { kind: "radial" });
    expect(tiles).toHaveLength(9);
    near(tiles[4]![4], start);
  });

  it("runs top to bottom inside a tile for a vertical gradient", () => {
    const tiles = tileSamples(stops, 2, 1, { kind: "linear", angle: 180 });
    near(tiles[0]![0], blend(0));
    near(tiles[0]![6], blend(0.4));
    near(tiles[1]![6], blend(1));
  });
});

describe("regionFit", () => {
  const samples = [0, 0.25, 0.5, 0, 0.25, 0.5, 0, 0.25, 0.5].map(blend);

  it("is 0 when the regions match the samples", () => {
    expect(regionFit(samples, samples, start)).toBe(0);
  });

  it("uses the fallback for missing regions", () => {
    const regions = samples.map((color, i) => (i === 4 ? null : color));
    expect(regionFit(regions, samples, blend(0.25))).toBe(0);
    expect(regionFit(regions, samples, blend(0.75))).toBeGreaterThan(0);
  });

  it("prefers a cover whose colors run the same way as the gradient", () => {
    const sameWay = [0.1, 0.3, 0.5, 0.1, 0.3, 0.5, 0.1, 0.3, 0.5].map(blend);
    const otherWay = [0.5, 0.3, 0.1, 0.5, 0.3, 0.1, 0.5, 0.3, 0.1].map(blend);
    expect(regionFit(sameWay, samples, start)).toBeLessThan(regionFit(otherWay, samples, start));
  });
});
