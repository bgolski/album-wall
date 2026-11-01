import { describe, expect, it } from "vitest";
import type { Album } from "@/types/index";
import type { CoverProfile } from "@/color/coverProfile";
import { hexToOklab } from "@/arrange/gradientTargets";
import { colorFamilies, suggestGradients } from "./suggestGradients";

function flat(hex: string): CoverProfile {
  const color = hexToOklab(hex)!;
  return { color, palette: [{ color, share: 1 }], regions: Array.from({ length: 9 }, () => color) };
}

// A collection made of `count` covers of each listed color.
function collection(counts: Record<string, number>) {
  const albums: Album[] = [];
  const profiles: Record<string, CoverProfile> = {};
  let id = 1;
  for (const [hex, count] of Object.entries(counts)) {
    for (let i = 0; i < count; i += 1) {
      albums.push({ id, title: `T${id}`, artist: `A${id}` });
      profiles[String(id)] = flat(hex);
      id += 1;
    }
  }
  return { albums, profiles };
}

describe("colorFamilies", () => {
  it("counts each cover once per color it mainly has, with the typical shade", () => {
    const pink = hexToOklab("#df9eba")!;
    const black = hexToOklab("#211f25")!;
    const families = colorFamilies(
      [
        { id: 1, title: "a", artist: "x" },
        { id: 2, title: "b", artist: "y" },
      ],
      {
        "1": {
          color: pink,
          palette: [
            { color: pink, share: 0.5 },
            { color: hexToOklab("#e8a5c0")!, share: 0.2 },
            { color: black, share: 0.3 },
          ],
          regions: [],
        },
        "2": flat("#111111"),
      }
    );
    expect(families.map((family) => [family.name, family.count])).toEqual([
      ["black", 2],
      ["pink", 1],
    ]);
  });
});

describe("suggestGradients", () => {
  const { albums, profiles } = collection({
    "#111111": 20,
    "#f5f5f5": 20,
    "#808080": 20,
    "#c62828": 15,
    "#1565c0": 12,
    "#2e7d32": 2,
  });
  const result = suggestGradients({ albums, profiles, rows: 4, columns: 8 });

  it("starts with a dark-to-light neutral gradient", () => {
    expect(
      result.suggestions[0]!.names.every((name) => ["black", "gray", "white"].includes(name))
    ).toBe(true);
  });

  it("then suggests gradients with colors the collection has enough of, each a different set", () => {
    const colorful = result.suggestions.slice(1);
    expect(colorful.length).toBeGreaterThan(0);
    expect(colorful.length).toBeLessThanOrEqual(3);
    const sets = colorful.map((item) =>
      item.names
        .filter((name) => !["black", "gray", "white"].includes(name))
        .sort()
        .join("+")
    );
    expect(new Set(sets).size).toBe(sets.length);
    expect(sets.every((set) => set.length > 0)).toBe(true);
    // Too few green covers to fill part of a 32-cover wall.
    expect(sets.some((set) => set.includes("green"))).toBe(false);
  });

  it("orders each gradient's colors from dark to light", () => {
    for (const item of result.suggestions) {
      const lightness = item.colors.map((hex) => hexToOklab(hex)!.l);
      expect([...lightness].sort((x, y) => x - y)).toEqual(lightness);
    }
  });

  it("uses a color once there are enough covers of it for the wall's size", () => {
    const few = collection({ "#111111": 5, "#f5f5f5": 5, "#2e7d32": 2 });
    const usesGreen = (rows: number, columns: number) =>
      suggestGradients({ ...few, rows, columns }).suggestions.some((item) =>
        item.names.includes("green")
      );
    expect(usesGreen(1, 3)).toBe(true);
    expect(usesGreen(3, 4)).toBe(false);
  });

  it("suggests nothing for a collection with no colors read", () => {
    expect(suggestGradients({ albums, profiles: {}, rows: 4, columns: 8 })).toEqual({
      suggestions: [],
    });
  });
});

describe("suggestGradients and brown", () => {
  it("does not count brown alone as a color for the colorful suggestions", () => {
    const { albums, profiles } = collection({ "#111111": 20, "#f5f5f5": 20, "#8b6a4f": 20 });
    const result = suggestGradients({ albums, profiles, rows: 4, columns: 8 });
    expect(result.suggestions.slice(1)).toEqual([]);
  });
});
