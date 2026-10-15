import { describe, expect, it } from "vitest";
import type { CoverColor } from "./colorBasics";
import { coverProfile } from "./coverProfile";

// Reference values come from an independent implementation of the same rules.
const red = { l: 0.627955, a: 0.224863, b: 0.125846 };
const black = { l: 0, a: 0, b: 0 };
const grey = { l: 0.599871, a: 0, b: 0 };
type Pixel = [number, number, number, number];
const RED: Pixel = [255, 0, 0, 255];
const BLACK: Pixel = [0, 0, 0, 255];
const GREY: Pixel = [128, 128, 128, 255];

function image(width: number, height: number, at: (x: number, y: number) => Pixel) {
  const pixels: number[] = [];
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) pixels.push(...at(x, y));
  return Uint8ClampedArray.from(pixels);
}

function near(actual: CoverColor | null | undefined, expected: CoverColor | null, digits = 4) {
  if (expected === null) {
    expect(actual).toBeNull();
    return;
  }
  expect(actual).toBeTruthy();
  expect(actual!.l).toBeCloseTo(expected.l, digits);
  expect(actual!.a).toBeCloseTo(expected.a, digits);
  expect(actual!.b).toBeCloseTo(expected.b, digits);
}

describe("coverProfile", () => {
  it("describes a single-color cover by that color everywhere", () => {
    const profile = coverProfile(
      image(6, 6, () => RED),
      6,
      6
    )!;
    near(profile.color, red);
    expect(profile.palette).toHaveLength(1);
    expect(profile.palette[0]!.share).toBe(1);
    near(profile.palette[0]!.color, red);
    expect(profile.regions).toHaveLength(9);
    profile.regions.forEach((region) => near(region, red));
  });

  it("picks the colorful half of a red and black cover, not their muddy average", () => {
    const profile = coverProfile(
      image(6, 6, (x) => (x < 3 ? RED : BLACK)),
      6,
      6
    )!;
    near(profile.color, red);
    expect(profile.palette.map((entry) => entry.share)).toEqual([0.5, 0.5]);
    near(profile.palette[0]!.color, red);
    near(profile.palette[1]!.color, black);
    const mixed = { l: 0.313978, a: 0.112432, b: 0.062923 };
    [0, 3, 6].forEach((i) => near(profile.regions[i], red));
    [1, 4, 7].forEach((i) => near(profile.regions[i], mixed));
    [2, 5, 8].forEach((i) => near(profile.regions[i], black));
  });

  it("lets a colorful spot win over a big grey area only once it is big enough to stand out", () => {
    const tiny = coverProfile(
      image(10, 10, (x, y) => (y * 10 + x < 9 ? RED : GREY)),
      10,
      10
    )!;
    near(tiny.color, grey);
    expect(tiny.palette.map((entry) => entry.share)).toEqual([0.91, 0.09]);
    const small = coverProfile(
      image(10, 10, (x, y) => (y * 10 + x < 12 ? RED : GREY)),
      10,
      10
    )!;
    near(small.color, grey);
    expect(small.palette.map((entry) => entry.share)).toEqual([0.88, 0.12]);
    const large = coverProfile(
      image(10, 10, (x, y) => (y * 10 + x < 20 ? RED : GREY)),
      10,
      10
    )!;
    near(large.color, red);
    expect(large.palette.map((entry) => entry.share)).toEqual([0.8, 0.2]);
  });

  it("picks the bigger of two grey areas, whatever faint tint the photo gives the smaller one", () => {
    // A cream area too faintly tinted to read as a color, beside a bigger black one.
    const CREAM: Pixel = [222, 214, 196, 255];
    const NEAR_BLACK: Pixel = [20, 20, 22, 255];
    const blackBigger = coverProfile(
      image(10, 10, (x) => (x < 6 ? NEAR_BLACK : CREAM)),
      10,
      10
    )!;
    expect(blackBigger.color.l).toBeLessThan(0.3);
    const creamBigger = coverProfile(
      image(10, 10, (x) => (x < 4 ? NEAR_BLACK : CREAM)),
      10,
      10
    )!;
    expect(creamBigger.color.l).toBeGreaterThan(0.8);
  });

  it("splits a cover that is not square into a 3 by 3 grid", () => {
    const columns: Pixel[] = [RED, [0, 255, 0, 255], [0, 0, 255, 255]];
    const profile = coverProfile(
      image(3, 6, (x, y) => (y < 2 ? columns[x]! : y < 4 ? [255, 255, 255, 255] : BLACK)),
      3,
      6
    )!;
    near(profile.regions[0], red);
    near(profile.regions[1], { l: 0.86644, a: -0.233888, b: 0.179498 });
    near(profile.regions[2], { l: 0.452014, a: -0.032457, b: -0.311528 });
    [3, 4, 5].forEach((i) => near(profile.regions[i], { l: 1, a: 0, b: 0 }));
    [6, 7, 8].forEach((i) => near(profile.regions[i], black));
  });

  it("ignores mostly transparent pixels and leaves an empty region as null", () => {
    const profile = coverProfile(
      image(3, 3, (x, y) => (x === 1 && y === 1 ? [0, 0, 0, 0] : [255, 0, 0, x === 0 ? 127 : 255])),
      3,
      3
    )!;
    expect(profile.regions[4]).toBeNull();
    expect(profile.regions[0]).toBeNull();
    near(profile.regions[2], red);
    expect(
      coverProfile(
        image(2, 2, () => [255, 0, 0, 0]),
        2,
        2
      )
    ).toBeNull();
    expect(coverProfile(new Uint8ClampedArray(0), 0, 0)).toBeNull();
  });

  it("gives the same answer every time, with shares that add up to one", () => {
    const at = (x: number, y: number): Pixel => [
      (x * 40) % 256,
      (y * 60) % 256,
      ((x + y) * 25) % 256,
      255,
    ];
    const first = coverProfile(image(12, 12, at), 12, 12)!;
    expect(coverProfile(image(12, 12, at), 12, 12)).toEqual(first);
    const total = first.palette.reduce((sum, entry) => sum + entry.share, 0);
    expect(total).toBeGreaterThan(0.97);
    expect(total).toBeLessThanOrEqual(1.004);
    expect(first.palette.length).toBeLessThanOrEqual(4);
    for (let i = 1; i < first.palette.length; i += 1) {
      expect(first.palette[i - 1]!.share).toBeGreaterThanOrEqual(first.palette[i]!.share);
    }
  });
});
