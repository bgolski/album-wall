import { describe, expect, it } from "vitest";
import { isCoverProfile, roundProfile } from "./profileShape";

const color = { l: 0.5, a: 0.1, b: -0.1 };
const good = {
  color,
  palette: [{ color, share: 1 }],
  regions: Array.from({ length: 9 }, (_, i) => (i === 4 ? null : color)),
};

describe("isCoverProfile", () => {
  it("accepts a profile", () => {
    expect(isCoverProfile(good)).toBe(true);
  });

  it("rejects anything missing or malformed", () => {
    for (const bad of [
      null,
      "x",
      { ...good, color: { l: 1 } },
      { ...good, palette: [] },
      { ...good, palette: [{ color, share: 2 }] },
      { ...good, palette: [{ color: "red", share: 0.5 }] },
      { ...good, regions: [color] },
      { ...good, regions: [...good.regions.slice(0, 8), "red"] },
    ]) {
      expect(isCoverProfile(bad)).toBe(false);
    }
  });
});

describe("roundProfile", () => {
  it("rounds every number to four decimals and keeps empty regions", () => {
    const precise = { l: 0.123456, a: -0.987654, b: 0.000049 };
    const rounded = roundProfile({
      color: precise,
      palette: [{ color: precise, share: 0.5 }],
      regions: [precise, null, precise, precise, precise, precise, precise, precise, precise],
    });
    expect(rounded.color).toEqual({ l: 0.1235, a: -0.9877, b: 0 });
    expect(rounded.palette[0]).toEqual({ color: { l: 0.1235, a: -0.9877, b: 0 }, share: 0.5 });
    expect(rounded.regions[1]).toBeNull();
  });
});
