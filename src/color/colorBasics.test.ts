import { describe, expect, it } from "vitest";
import {
  chromaOf,
  colorDistance,
  hueOf,
  isCoverColor,
  NEUTRAL_CHROMA,
  type CoverColor,
} from "./colorBasics";

const lch = (l: number, c: number, h: number): CoverColor => ({
  l,
  a: c * Math.cos((h * Math.PI) / 180),
  b: c * Math.sin((h * Math.PI) / 180),
});

describe("chromaOf and hueOf", () => {
  it("reads chroma and hue back from a color", () => {
    const color = lch(0.6, 0.12, 200);
    expect(chromaOf(color)).toBeCloseTo(0.12, 10);
    expect(hueOf(color)).toBeCloseTo(200, 8);
  });

  it("keeps hue between 0 and 360", () => {
    expect(hueOf(lch(0.5, 0.1, 350))).toBeCloseTo(350, 8);
    expect(hueOf({ l: 0.5, a: 0.1, b: 0 })).toBe(0);
    expect(hueOf({ l: 0.5, a: 0, b: -0.1 })).toBeCloseTo(270, 8);
  });

  it("treats a grey as having no chroma and a small chroma as neutral", () => {
    expect(chromaOf({ l: 0.5, a: 0, b: 0 })).toBe(0);
    expect(chromaOf(lch(0.5, 0.03, 90))).toBeLessThan(NEUTRAL_CHROMA);
  });
});

describe("isCoverColor", () => {
  it("accepts a color and rejects anything else", () => {
    expect(isCoverColor({ l: 0.5, a: 0, b: -0.1 })).toBe(true);
    for (const bad of [
      null,
      undefined,
      3,
      "x",
      [],
      {},
      { l: 0.5, a: 0 },
      { l: "1", a: 0, b: 0 },
      { l: NaN, a: 0, b: 0 },
      { l: Infinity, a: 0, b: 0 },
    ]) {
      expect(isCoverColor(bad)).toBe(false);
    }
  });
});

describe("colorDistance", () => {
  it("is zero for equal colors and symmetric", () => {
    const x = lch(0.7, 0.1, 40);
    const y = lch(0.4, 0.2, 220);
    expect(colorDistance(x, x)).toBe(0);
    expect(colorDistance(x, y)).toBeCloseTo(colorDistance(y, x), 12);
  });

  it("is the straight-line distance", () => {
    expect(colorDistance({ l: 0, a: 0, b: 0 }, { l: 0.3, a: 0.4, b: 0 })).toBeCloseTo(0.5, 12);
  });
});
