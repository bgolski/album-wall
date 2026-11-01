import { describe, expect, it } from "vitest";
import type { CoverColor } from "@/color/colorBasics";
import { gradientTargets, hexToOklab, oklabToHex, type GradientStop } from "./gradientTargets";

// Reference values come from an independent implementation of the published OKLab transforms.
const near = (actual: CoverColor | null, expected: CoverColor, digits = 4) => {
  expect(actual).not.toBeNull();
  expect(actual!.l).toBeCloseTo(expected.l, digits);
  expect(actual!.a).toBeCloseTo(expected.a, digits);
  expect(actual!.b).toBeCloseTo(expected.b, digits);
};

// Binary fractions keep the blended colors exact.
const start: CoverColor = { l: 0.25, a: 0.125, b: -0.125 };
const end: CoverColor = { l: 0.75, a: -0.125, b: 0.125 };
const middle: CoverColor = { l: 0.5, a: 0, b: 0 };
const two: GradientStop[] = [
  { color: start, at: 0 },
  { color: end, at: 1 },
];

describe("hexToOklab", () => {
  it.each([
    ["#ff0000", { l: 0.627955, a: 0.224863, b: 0.125846 }],
    ["#f00", { l: 0.627955, a: 0.224863, b: 0.125846 }],
    ["#FF0000", { l: 0.627955, a: 0.224863, b: 0.125846 }],
    ["#00ff00", { l: 0.86644, a: -0.233888, b: 0.179498 }],
    ["#0000ff", { l: 0.452014, a: -0.032457, b: -0.311528 }],
    ["#ffffff", { l: 1, a: 0, b: 0 }],
    ["#000000", { l: 0, a: 0, b: 0 }],
    ["#2a7b9b", { l: 0.548565, a: -0.060321, b: -0.067997 }],
    ["#57c785", { l: 0.747543, a: -0.127622, b: 0.059671 }],
  ])("reads %s", (hex, expected) => {
    near(hexToOklab(hex), expected);
  });

  it.each(["", "red", "ff0000", "#12", "#12345", "#1234567", "#gggggg", "#ff00", " #ff0000"])(
    "rejects %j",
    (hex) => {
      expect(hexToOklab(hex)).toBeNull();
    }
  );
});

describe("oklabToHex", () => {
  it.each([
    [{ l: 0.627955, a: 0.224863, b: 0.125846 }, "#ff0000"],
    [{ l: 0.86644, a: -0.233888, b: 0.179498 }, "#00ff00"],
    [{ l: 0.452014, a: -0.032457, b: -0.311528 }, "#0000ff"],
    [{ l: 1, a: 0, b: 0 }, "#ffffff"],
    [{ l: 0, a: 0, b: 0 }, "#000000"],
    [{ l: 0.599871, a: 0, b: 0 }, "#808080"],
  ])("writes %j as %s", (color, hex) => {
    expect(oklabToHex(color)).toBe(hex);
  });

  it("clamps colors outside the screen's range", () => {
    expect(oklabToHex({ l: 1, a: 0.3, b: 0.3 })).toBe("#ff4500");
    expect(oklabToHex({ l: 0.5, a: -0.4, b: 0.2 })).toBe("#009700");
    expect(oklabToHex({ l: 1.2, a: 0, b: 0 })).toBe("#ffffff");
  });

  it("gives back the same hex after a round trip", () => {
    for (const hex of [
      "#2a7b9b",
      "#57c785",
      "#eddd53",
      "#808080",
      "#102030",
      "#ff0000",
      "#010203",
    ]) {
      expect(oklabToHex(hexToOklab(hex)!)).toBe(hex);
    }
  });
});

describe("gradientTargets", () => {
  it("runs left to right at angle 90, with the end colors in the first and last columns", () => {
    const targets = gradientTargets(two, 1, 4, { kind: "linear", angle: 90 });
    expect(targets).toHaveLength(4);
    near(targets[0]!, start, 9);
    near(targets[3]!, end, 9);
    near(targets[1]!, { l: 0.25 + 0.5 / 3, a: 0.125 - 0.25 / 3, b: -0.125 + 0.25 / 3 }, 9);
    near(targets[2]!, { l: 0.25 + 1 / 3, a: 0.125 - 0.5 / 3, b: -0.125 + 0.5 / 3 }, 9);
  });

  it("runs top to bottom at 180, right to left at 270 and bottom to top at 0", () => {
    const down = gradientTargets(two, 4, 1, { kind: "linear", angle: 180 });
    near(down[0]!, start, 9);
    near(down[3]!, end, 9);
    const left = gradientTargets(two, 1, 3, { kind: "linear", angle: 270 });
    near(left[0]!, end, 9);
    near(left[2]!, start, 9);
    near(left[1]!, middle, 9);
    const up = gradientTargets(two, 3, 1, { kind: "linear", angle: 0 });
    near(up[0]!, end, 9);
    near(up[2]!, start, 9);
  });

  it("runs corner to corner at 45 degrees on a 2 by 2 wall", () => {
    const targets = gradientTargets(two, 2, 2, { kind: "linear", angle: 45 });
    near(targets[2]!, start, 9); // bottom left
    near(targets[3]!, middle, 9); // bottom right
    near(targets[0]!, middle, 9); // top left
    near(targets[1]!, end, 9); // top right
  });

  it("puts the first stop at the center and the last at the corners for a radial gradient", () => {
    const targets = gradientTargets(two, 3, 3, { kind: "radial" });
    expect(targets).toHaveLength(9);
    near(targets[4]!, start, 9);
    for (const corner of [0, 2, 6, 8]) near(targets[corner]!, end, 9);
    const t = 1 / Math.SQRT2;
    near(targets[1]!, { l: 0.25 + 0.5 * t, a: 0.125 - 0.25 * t, b: -0.125 + 0.25 * t }, 9);
  });

  it("holds the end colors beyond the first and last stop", () => {
    const stops: GradientStop[] = [
      { color: start, at: 0.25 },
      { color: end, at: 0.75 },
    ];
    const targets = gradientTargets(stops, 1, 5, { kind: "linear", angle: 90 });
    near(targets[0]!, start, 9);
    near(targets[1]!, start, 9);
    near(targets[2]!, middle, 9);
    near(targets[3]!, end, 9);
    near(targets[4]!, end, 9);
  });

  it("does not depend on the order the stops are given in", () => {
    const shuffled: GradientStop[] = [
      { color: end, at: 1 },
      { color: start, at: 0 },
    ];
    expect(gradientTargets(shuffled, 1, 4, { kind: "linear", angle: 90 })).toEqual(
      gradientTargets(two, 1, 4, { kind: "linear", angle: 90 })
    );
  });

  it("blends through three stops", () => {
    const green: CoverColor = { l: 0.5, a: 0.5, b: 0 };
    const stops: GradientStop[] = [
      { color: start, at: 0 },
      { color: green, at: 0.5 },
      { color: end, at: 1 },
    ];
    const targets = gradientTargets(stops, 1, 3, { kind: "linear", angle: 90 });
    near(targets[0]!, start, 9);
    near(targets[1]!, green, 9);
    near(targets[2]!, end, 9);
  });

  it("gives one color everywhere for a single stop and nothing for no stops", () => {
    expect(gradientTargets([{ color: start, at: 0.3 }], 2, 2, { kind: "radial" })).toEqual([
      start,
      start,
      start,
      start,
    ]);
    expect(gradientTargets([], 2, 2, { kind: "linear", angle: 90 })).toEqual([]);
  });

  it("uses the first stop when every position is at the same place along the gradient", () => {
    expect(gradientTargets(two, 1, 1, { kind: "linear", angle: 90 })).toEqual([start]);
    const column = gradientTargets(two, 3, 1, { kind: "linear", angle: 90 });
    for (const color of column) near(color, start, 9);
  });
});
