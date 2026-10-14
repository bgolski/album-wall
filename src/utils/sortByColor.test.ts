import { describe, expect, it } from "vitest";
import type { Album } from "@/types";
import type { CoverColor } from "./colorBasics";
import { sortAlbumsByColor } from "./sortByColor";

const lch = (l: number, c: number, h: number): CoverColor => ({
  l,
  a: c * Math.cos((h * Math.PI) / 180),
  b: c * Math.sin((h * Math.PI) / 180),
});
const album = (id: number): Album => ({ id, title: `Album ${id}`, artist: "Artist" });
const key = (item: Album) => String(item.id);
const ids = (list: Album[]) => list.map((item) => item.id);

describe("sortAlbumsByColor", () => {
  it("orders colorful covers by hue, starting at 20 degrees and wrapping", () => {
    const colors = {
      "1": lch(0.6, 0.15, 30),
      "2": lch(0.6, 0.15, 140),
      "3": lch(0.6, 0.15, 265),
      "4": lch(0.6, 0.15, 350),
      "5": lch(0.6, 0.15, 10),
    };
    expect(ids(sortAlbumsByColor([3, 5, 1, 4, 2].map(album), colors, key))).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it("puts lighter covers first when the hue matches", () => {
    const colors = { "1": lch(0.4, 0.15, 140), "2": lch(0.8, 0.15, 140) };
    expect(ids(sortAlbumsByColor([1, 2].map(album), colors, key))).toEqual([2, 1]);
  });

  it("places neutral covers after the colorful ones, light to dark", () => {
    const colors = {
      "1": lch(0.1, 0.005, 40),
      "2": lch(0.6, 0.15, 200),
      "3": lch(0.95, 0.01, 90),
      "4": lch(0.5, 0.02, 300),
    };
    expect(ids(sortAlbumsByColor([1, 2, 3, 4].map(album), colors, key))).toEqual([2, 3, 4, 1]);
  });

  it("puts covers with no color last, in their original order", () => {
    const colors: Record<string, CoverColor | null> = {
      "1": null,
      "2": lch(0.6, 0.15, 200),
      "4": lch(0.5, 0.01, 10),
    };
    expect(ids(sortAlbumsByColor([1, 2, 3, 4, 5].map(album), colors, key))).toEqual([
      2, 4, 1, 3, 5,
    ]);
  });

  it("keeps the original order for equal colors", () => {
    const same = lch(0.6, 0.15, 100);
    const colors = { "7": same, "8": same, "9": same };
    expect(ids(sortAlbumsByColor([8, 9, 7].map(album), colors, key))).toEqual([8, 9, 7]);
  });

  it("returns a new array and leaves the input alone", () => {
    const input = [2, 1].map(album);
    const colors = { "1": lch(0.6, 0.15, 30), "2": lch(0.6, 0.15, 140) };
    const output = sortAlbumsByColor(input, colors, key);
    expect(output).not.toBe(input);
    expect(ids(input)).toEqual([2, 1]);
    expect(ids(output)).toEqual([1, 2]);
  });

  it("gives the same order every time", () => {
    const colors = { "1": lch(0.6, 0.15, 30), "2": lch(0.7, 0.15, 30), "3": lch(0.3, 0.01, 0) };
    const input = [3, 2, 1].map(album);
    expect(ids(sortAlbumsByColor(input, colors, key))).toEqual(
      ids(sortAlbumsByColor(input, colors, key))
    );
  });

  it("handles an empty list", () => {
    expect(sortAlbumsByColor([], {}, key)).toEqual([]);
  });
});
