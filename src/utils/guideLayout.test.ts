import { describe, expect, it } from "vitest";
import type { Album } from "@/types";
import { guideEntries, paginateEntries, paperFor } from "./guideLayout";

const album = (id: number, title: string, artist: string) => ({ id, title, artist }) as Album;

describe("guideEntries", () => {
  it("numbers rows and columns from 1, row by row", () => {
    const entries = guideEntries(
      [album(1, "A", "x"), album(2, "B", "y"), album(3, "C", "z"), album(4, "D", "w")],
      3
    );
    expect(entries.map((e) => [e.row, e.column, e.title])).toEqual([
      [1, 1, "A"],
      [1, 2, "B"],
      [1, 3, "C"],
      [2, 1, "D"],
    ]);
  });

  it("names a record that has no title", () => {
    expect(guideEntries([album(1, "", "")], 4)[0]!.title).toBe("Untitled");
  });
});

describe("paginateEntries", () => {
  it("fills the first page to its room and the rest to theirs", () => {
    const pages = paginateEntries([1, 2, 3, 4, 5, 6, 7], 2, 3);
    expect(pages).toEqual([
      [1, 2],
      [3, 4, 5],
      [6, 7],
    ]);
  });

  it("keeps an empty first page when the wall leaves no room", () => {
    expect(paginateEntries([1, 2], 0, 5)).toEqual([[], [1, 2]]);
  });

  it("makes one page for nothing", () => {
    expect(paginateEntries([], 4, 4)).toEqual([[]]);
  });
});

describe("paperFor", () => {
  it("uses Letter in the United States and Canada, A4 elsewhere", () => {
    expect(paperFor("en-US").points.width).toBe(612);
    expect(paperFor("en-CA").points.width).toBe(612);
    expect(paperFor("en-GB").points.width).toBeCloseTo(595.28);
    expect(paperFor("de").points.width).toBeCloseTo(595.28);
    expect(paperFor(undefined).points.width).toBeCloseTo(595.28);
  });
});
