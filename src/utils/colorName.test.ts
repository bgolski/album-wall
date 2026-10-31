import { describe, expect, it } from "vitest";
import { colorName, mainColors, namedMainColors } from "./colorName";
import { hexToOklab } from "./gradientTargets";

const named = (hex: string) => colorName(hexToOklab(hex)!);

describe("colorName", () => {
  it("names the colors people use for covers", () => {
    expect(
      ["#d32f2f", "#df9eba", "#f57c00", "#fdd835", "#388e3c", "#1976d2", "#7b1fa2", "#8b5a2b"].map(
        named
      )
    ).toEqual(["red", "pink", "orange", "yellow", "green", "blue", "purple", "brown"]);
  });

  it("names neutrals by lightness", () => {
    expect(["#111111", "#808080", "#f5f5f5"].map(named)).toEqual(["black", "gray", "white"]);
  });
});

describe("mainColors and namedMainColors", () => {
  const black = hexToOklab("#111111")!;
  const charcoal = hexToOklab("#2a2a2a")!;
  const red = hexToOklab("#d32f2f")!;
  const profile = {
    color: red,
    palette: [
      { color: charcoal, share: 0.1 },
      { color: red, share: 0.4 },
      { color: black, share: 0.12 },
      { color: hexToOklab("#1976d2")!, share: 0.38 },
    ],
    regions: [],
  };

  it("keeps palette colors covering at least 15% of the cover, biggest first", () => {
    expect(mainColors(profile).map((entry) => entry.share)).toEqual([0.4, 0.38]);
  });

  it("merges shades with the same name, so two small blacks make one main color", () => {
    const named = namedMainColors(profile);
    expect(named.map((entry) => [entry.name, Number(entry.share.toFixed(2))])).toEqual([
      ["red", 0.4],
      ["blue", 0.38],
      ["black", 0.22],
    ]);
    // The biggest shade stands for the merged color.
    expect(named[2]!.color).toEqual(black);
  });

  it("falls back to the biggest color when none covers 15%", () => {
    const thin = {
      ...profile,
      palette: [
        { color: red, share: 0.1 },
        { color: black, share: 0.12 },
      ],
    };
    expect(mainColors(thin).map((entry) => entry.share)).toEqual([0.12]);
  });
});
