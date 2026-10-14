import { describe, expect, it } from "vitest";
import type { CoverColor } from "./colorBasics";
import { srgbToOklab } from "./coverColor";

// Reference values come from an independent implementation of the published OKLab transform.
function expectColor(actual: CoverColor | null, expected: CoverColor, digits = 4) {
  expect(actual).not.toBeNull();
  expect(actual!.l).toBeCloseTo(expected.l, digits);
  expect(actual!.a).toBeCloseTo(expected.a, digits);
  expect(actual!.b).toBeCloseTo(expected.b, digits);
}

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
