import { describe, expect, it } from "vitest";
import type { CoverColor } from "./colorBasics";
import { edgeFit, wallEdgeCost } from "./neighbourFit";

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

describe("wallEdgeCost", () => {
  it("adds up every touching pair of a 2 by 2 wall", () => {
    const regions = [leftToRight, leftToRight, topToBottom, topToBottom];
    const cost = wallEdgeCost(
      [0, 1, 2, 3],
      (cover) => regions[cover]!,
      () => fallback,
      2
    );
    const expected =
      edgeFit(leftToRight, leftToRight, "horizontal", fallback, fallback) +
      edgeFit(topToBottom, topToBottom, "horizontal", fallback, fallback) +
      edgeFit(leftToRight, topToBottom, "vertical", fallback, fallback) * 2;
    expect(cost).toBeCloseTo(expected, 12);
  });

  it("never joins the end of a row to the start of the next, and skips empty spots", () => {
    const regions = [leftToRight, topToBottom, leftToRight];
    const oneRow = wallEdgeCost(
      [0, 1, 2],
      (c) => regions[c]!,
      () => fallback,
      3
    );
    expect(oneRow).toBeCloseTo(
      edgeFit(leftToRight, topToBottom, "horizontal", fallback, fallback) +
        edgeFit(topToBottom, leftToRight, "horizontal", fallback, fallback),
      12
    );
    const wrapped = wallEdgeCost(
      [0, 1, 2],
      (c) => regions[c]!,
      () => fallback,
      2
    );
    expect(wrapped).toBeCloseTo(
      edgeFit(leftToRight, topToBottom, "horizontal", fallback, fallback) +
        edgeFit(leftToRight, leftToRight, "vertical", fallback, fallback),
      12
    );
    expect(
      wallEdgeCost(
        [0, -1, 2],
        (c) => regions[c]!,
        () => fallback,
        3
      )
    ).toBe(0);
  });
});
