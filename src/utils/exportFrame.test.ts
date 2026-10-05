import { describe, expect, it } from "vitest";
import { EXPORT_PRESETS, fitIntoFrame } from "./exportFrame";

describe("EXPORT_PRESETS", () => {
  it("lists the phone, desktop and square sizes in that order", () => {
    expect(EXPORT_PRESETS.map(({ id, width, height }) => [id, width, height])).toEqual([
      ["phone", 1179, 2556],
      ["desktop", 2560, 1440],
      ["square", 3000, 3000],
    ]);
    for (const preset of EXPORT_PRESETS) expect(preset.label.length).toBeGreaterThan(0);
  });
});

describe("fitIntoFrame", () => {
  it("scales a wide wall to the frame width and centres it vertically", () => {
    const fit = fitIntoFrame(800, 600, 1179, 2556);
    expect(fit.scale).toBeCloseTo(1179 / 800);
    expect(fit.width).toBeCloseTo(1179);
    expect(fit.height).toBeCloseTo(600 * (1179 / 800));
    expect(fit.x).toBeCloseTo(0);
    expect(fit.y).toBeCloseTo((2556 - fit.height) / 2);
  });

  it("scales a tall wall to the frame height and centres it horizontally", () => {
    const fit = fitIntoFrame(400, 800, 2560, 1440);
    expect(fit.scale).toBeCloseTo(1440 / 800);
    expect(fit.height).toBeCloseTo(1440);
    expect(fit.width).toBeCloseTo(720);
    expect(fit.x).toBeCloseTo((2560 - 720) / 2);
    expect(fit.y).toBeCloseTo(0);
  });

  it("can scale down as well as up", () => {
    const fit = fitIntoFrame(6000, 6000, 3000, 3000);
    expect(fit.scale).toBeCloseTo(0.5);
    expect([fit.x, fit.y, fit.width, fit.height]).toEqual([0, 0, 3000, 3000]);
  });

  it("keeps the padding clear on every side", () => {
    const fit = fitIntoFrame(1000, 1000, 3000, 3000, 100);
    expect(fit.scale).toBeCloseTo(2.8);
    expect(fit.x).toBeCloseTo(100);
    expect(fit.y).toBeCloseTo(100);
    expect(fit.width).toBeCloseTo(2800);
  });

  it("rejects sizes that cannot be fitted", () => {
    expect(() => fitIntoFrame(0, 100, 100, 100)).toThrow(RangeError);
    expect(() => fitIntoFrame(100, -1, 100, 100)).toThrow(RangeError);
    expect(() => fitIntoFrame(100, 100, 0, 100)).toThrow(RangeError);
    expect(() => fitIntoFrame(100, 100, 100, 100, 50)).toThrow(RangeError);
    expect(() => fitIntoFrame(100, 100, 100, 100, -1)).toThrow(RangeError);
  });
});
