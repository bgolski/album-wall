import { describe, expect, it } from "vitest";
import type { CoverColor } from "./colorBasics";
import { dominantColor, srgbToOklab } from "./coverColor";

// Reference values come from an independent implementation of the published OKLab transform.
function expectColor(actual: CoverColor | null, expected: CoverColor, digits = 4) {
  expect(actual).not.toBeNull();
  expect(actual!.l).toBeCloseTo(expected.l, digits);
  expect(actual!.a).toBeCloseTo(expected.a, digits);
  expect(actual!.b).toBeCloseTo(expected.b, digits);
}

const rgba = (rows: [number, number, number, number][]) => Uint8ClampedArray.from(rows.flat());

describe("srgbToOklab", () => {
  it.each([
    ["white", [255, 255, 255], { l: 1, a: 0, b: 0 }],
    ["black", [0, 0, 0], { l: 0, a: 0, b: 0 }],
    ["mid grey", [128, 128, 128], { l: 0.599871, a: 0, b: 0 }],
    ["red", [255, 0, 0], { l: 0.627955, a: 0.224863, b: 0.125846 }],
    ["green", [0, 255, 0], { l: 0.86644, a: -0.233888, b: 0.179498 }],
    ["blue", [0, 0, 255], { l: 0.452014, a: -0.032457, b: -0.311528 }],
    ["teal", [20, 120, 140], { l: 0.529095, a: -0.072299, b: -0.051851 }],
  ] as const)("converts %s", (_name, [r, g, b], expected) => {
    expectColor(srgbToOklab(r, g, b), expected);
  });
});

describe("dominantColor", () => {
  it("returns null when there are no pixels", () => {
    expect(dominantColor(new Uint8ClampedArray(0))).toBeNull();
  });

  it("returns null when every pixel is mostly transparent", () => {
    expect(
      dominantColor(
        rgba([
          [255, 0, 0, 0],
          [0, 255, 0, 127],
        ])
      )
    ).toBeNull();
  });

  it("returns a single opaque pixel's own color", () => {
    expectColor(dominantColor(rgba([[20, 120, 140, 255]])), srgbToOklab(20, 120, 140));
  });

  it("ignores alpha below 128 and counts alpha 128", () => {
    expectColor(
      dominantColor(
        rgba([
          [255, 0, 0, 127],
          [0, 255, 0, 128],
        ])
      ),
      srgbToOklab(0, 255, 0)
    );
  });

  it("does not depend on pixel order", () => {
    const red: [number, number, number, number] = [255, 0, 0, 255];
    const blue: [number, number, number, number] = [0, 0, 255, 255];
    const forward = dominantColor(rgba([red, blue]));
    const backward = dominantColor(rgba([blue, red]));
    expectColor(forward, { l: 0.533648, a: 0.086935, b: -0.108594 });
    expectColor(backward, forward!, 10);
  });

  it("weights colorful pixels more than grey ones", () => {
    const grey: [number, number, number, number] = [128, 128, 128, 255];
    const red: [number, number, number, number] = [255, 0, 0, 255];
    const mixed = dominantColor(rgba([...Array(90).fill(grey), ...Array(10).fill(red)]));
    expectColor(mixed, { l: 0.607858, a: 0.063951, b: 0.035791 });
    // A plain average would put the red component at 0.022486.
    expect(mixed!.a).toBeGreaterThan(0.05);
  });
});
