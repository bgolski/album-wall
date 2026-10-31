import { describe, expect, it } from "vitest";
import type { CoverColor } from "./colorBasics";
import { edgeFit } from "./neighbourFit";

// Grey levels at exact binary fractions, so every distance is exact.
const grey = (l: number): CoverColor => ({ l, a: 0, b: 0 });
// A cover whose 3 by 3 regions run from dark on the left to light on the right.
const leftToRight = [0, 0.25, 0.5, 0, 0.25, 0.5, 0, 0.25, 0.5].map(grey);
// A cover whose regions run from dark at the top to light at the bottom.
const topToBottom = [0, 0, 0, 0.25, 0.25, 0.25, 0.5, 0.5, 0.5].map(grey);
const fallback = grey(0.125);

describe("edgeFit", () => {
  it("compares the right column of the left cover with the left column of the right one", () => {
    expect(edgeFit(leftToRight, leftToRight, "horizontal", fallback, fallback)).toBe(0.5);
    const lightLeft = [0.5, 0.75, 1, 0.5, 0.75, 1, 0.5, 0.75, 1].map(grey);
    expect(edgeFit(leftToRight, lightLeft, "horizontal", fallback, fallback)).toBe(0);
  });

  it("compares the bottom row of the upper cover with the top row of the lower one", () => {
    expect(edgeFit(topToBottom, topToBottom, "vertical", fallback, fallback)).toBe(0.5);
    expect(edgeFit(topToBottom, leftToRight, "vertical", fallback, fallback)).toBeCloseTo(0.25, 12);
  });

  it("uses each cover's fallback for its missing regions", () => {
    const holes = leftToRight.map((color, i) => (i === 2 || i === 5 || i === 8 ? null : color));
    expect(edgeFit(holes, leftToRight, "horizontal", grey(0), fallback)).toBe(0);
  });
});
