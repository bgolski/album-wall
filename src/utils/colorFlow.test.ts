import { describe, expect, it } from "vitest";
import type { CoverColor } from "./colorBasics";
import { flowScore, wallSeams, worstSeams } from "./colorFlow";

// Colors that differ only in lightness, so every distance is easy to read off.
const grey = (l: number): CoverColor => ({ l, a: 0, b: 0 });
// A 3 by 2 wall whose lightness grows by 0.125 per step (exact in binary, so equal distances compare equal).
const ramp = [0, 0.125, 0.25, 0.375, 0.5, 0.625].map(grey);

describe("wallSeams", () => {
  it("measures every touching pair on a 3 by 2 wall", () => {
    const seams = wallSeams(ramp, 3);
    expect(seams).toHaveLength(7);
    const find = (a: number, b: number) => seams.find((seam) => seam.a === a && seam.b === b);
    expect(find(0, 1)!.distance).toBeCloseTo(0.125, 10);
    expect(find(4, 5)!.distance).toBeCloseTo(0.125, 10);
    expect(find(0, 3)!.distance).toBeCloseTo(0.375, 10);
    expect(find(2, 5)!.distance).toBeCloseTo(0.375, 10);
  });

  it("never joins the end of a row to the start of the next", () => {
    const seams = wallSeams(ramp, 3);
    expect(seams.some((seam) => seam.a === 2 && seam.b === 3)).toBe(false);
  });

  it("drops only the seams that touch a cover with no color", () => {
    const colors: (CoverColor | null)[] = [...ramp];
    colors[4] = null;
    const seams = wallSeams(colors, 3);
    expect(seams).toHaveLength(4);
    expect(seams.every((seam) => seam.a !== 4 && seam.b !== 4)).toBe(true);
  });

  it("uses vertical seams only for a single column", () => {
    const seams = wallSeams(ramp.slice(0, 4), 1);
    expect(seams.map((seam) => [seam.a, seam.b])).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
    ]);
  });

  it("returns nothing for an empty wall or one cover", () => {
    expect(wallSeams([], 3)).toEqual([]);
    expect(wallSeams([grey(0.5)], 3)).toEqual([]);
  });
});

describe("flowScore", () => {
  it("is the mean seam distance", () => {
    expect(flowScore(wallSeams(ramp, 3))).toBeCloseTo((4 * 0.125 + 3 * 0.375) / 7, 10);
  });

  it("is 0 when every cover has the same color", () => {
    expect(flowScore(wallSeams(Array(6).fill(grey(0.4)), 3))).toBe(0);
  });

  it("is lower when similar covers sit together", () => {
    const smooth = [0.1, 0.12, 0.9, 0.1, 0.12, 0.9].map(grey);
    const jumpy = [0.1, 0.9, 0.12, 0.9, 0.1, 0.12].map(grey);
    expect(flowScore(wallSeams(smooth, 3))!).toBeLessThan(flowScore(wallSeams(jumpy, 3))!);
  });

  it("is null when there are no seams", () => {
    expect(flowScore([])).toBeNull();
  });
});

describe("worstSeams", () => {
  it("lists the largest distances first and breaks ties by the lower position", () => {
    const worst = worstSeams(wallSeams(ramp, 3), 3);
    expect(worst.map((seam) => [seam.a, seam.b])).toEqual([
      [0, 3],
      [1, 4],
      [2, 5],
    ]);
  });

  it("returns fewer seams when there are fewer, and none for a count of 0", () => {
    expect(worstSeams(wallSeams(ramp, 3), 20)).toHaveLength(7);
    expect(worstSeams(wallSeams(ramp, 3), 0)).toEqual([]);
  });

  it("does not change the list it is given", () => {
    const seams = wallSeams(ramp, 3);
    const copy = seams.map((seam) => ({ ...seam }));
    worstSeams(seams, 2);
    expect(seams).toEqual(copy);
  });
});
