import { describe, expect, it } from "vitest";
import { POSTER_PIXELS, posterFrame, posterLayout } from "./posterLayout";

describe("posterFrame", () => {
  it("is upright for a tall or squarish wall and sideways for a wide one", () => {
    expect(posterFrame("18x24", 4, 4)).toEqual({ width: 5400, height: 7200 });
    expect(posterFrame("24x36", 8, 4)).toEqual({ width: 7200, height: 10800 });
    expect(posterFrame("24x36", 4, 8)).toEqual({ width: 10800, height: 7200 });
    expect(posterFrame("18x24", 5, 6)).toEqual({ width: 5400, height: 7200 });
    expect(posterFrame("18x24", 4, 5)).toEqual({ width: 7200, height: 5400 });
  });
});

describe("posterLayout", () => {
  it("keeps a margin of 5% and centres the wall, with square covers", () => {
    const layout = posterLayout("18x24", 4, 4);
    expect([layout.width, layout.height]).toEqual([5400, 7200]);
    const wall = 4 * layout.tile + 3 * layout.gap;
    expect(wall).toBeLessThanOrEqual(5400 - 2 * 270);
    expect(layout.left).toBe(Math.round((5400 - wall) / 2));
    expect(layout.top).toBe(Math.round((7200 - wall) / 2));
  });

  it("turns the poster sideways for a wide wall", () => {
    const layout = posterLayout("24x36", 4, 8);
    expect([layout.width, layout.height]).toEqual([10800, 7200]);
    expect(layout.top).toBeGreaterThan(0);
  });

  it("makes the large size 4/3 as wide as the small one", () => {
    expect(POSTER_PIXELS["24x36"].short / POSTER_PIXELS["18x24"].short).toBeCloseTo(4 / 3);
  });
});
