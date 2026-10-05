import { describe, expect, it } from "vitest";
import { giveCopiesUniqueIds } from "./uniqueAlbumIds";
import type { Album } from "@/types";

const album = (id: number, title: string): Album => ({ id, title, artist: "Artist" });

describe("giveCopiesUniqueIds", () => {
  it("leaves a collection without duplicates unchanged", () => {
    const albums = [album(1, "A"), album(2, "B")];
    const result = giveCopiesUniqueIds(albums);
    expect(result).toEqual(albums);
    expect(result[0]).toBe(albums[0]);
    expect(result[1]).toBe(albums[1]);
  });

  it("keeps the first copy's id and numbers later copies", () => {
    const albums = [album(7, "First"), album(3, "Other"), album(7, "Second"), album(7, "Third")];
    expect(giveCopiesUniqueIds(albums).map((a) => [a.id, a.title])).toEqual([
      [7, "First"],
      [3, "Other"],
      [-701, "Second"],
      [-702, "Third"],
    ]);
  });

  it("numbers each release's copies separately", () => {
    const albums = [album(5, "a"), album(9, "b"), album(9, "c"), album(5, "d")];
    expect(giveCopiesUniqueIds(albums).map((a) => a.id)).toEqual([5, 9, -901, -501]);
  });

  it("does not mutate the input", () => {
    const albums = [album(4, "a"), album(4, "b")];
    const result = giveCopiesUniqueIds(albums);
    expect(albums.map((a) => a.id)).toEqual([4, 4]);
    expect(result).not.toBe(albums);
    expect(result[1]).not.toBe(albums[1]);
    expect(result[1]).toEqual({ ...albums[1], id: -401 });
  });

  it("gives every album a distinct id", () => {
    const albums = [1, 2, 1, 2, 1, 3, 3].map((id, i) => album(id, String(i)));
    const ids = giveCopiesUniqueIds(albums).map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("handles an empty collection", () => {
    expect(giveCopiesUniqueIds([])).toEqual([]);
  });
});
