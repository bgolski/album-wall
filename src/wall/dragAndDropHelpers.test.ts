import { describe, it, expect } from "vitest";
import { swapAlbums } from "./dragAndDropHelpers";
import type { Album } from "@/types/index";

const createAlbum = (id: number): Album => ({ id, title: `Title ${id}`, artist: "artist" });
const albums = (...ids: number[]) => ids.map(createAlbum);
const ids = (list: Album[] | null) => list?.map((album) => album.id);

describe("swapAlbums", () => {
  // The wall (1-6) followed by the pool (7-9): a swap works the same anywhere in the list.
  const all = albums(1, 2, 3, 4, 5, 6, 7, 8, 9);
  const none = new Set<string>();

  it("swaps two wall albums and leaves every other place as it was", () => {
    expect(ids(swapAlbums(all, "album-5", "album-2", none))).toEqual([1, 5, 3, 4, 2, 6, 7, 8, 9]);
  });

  it("swaps adjacent albums and the first and last places", () => {
    expect(ids(swapAlbums(all, "album-1", "album-2", none))).toEqual([2, 1, 3, 4, 5, 6, 7, 8, 9]);
    expect(ids(swapAlbums(all, "album-9", "album-1", none))).toEqual([9, 2, 3, 4, 5, 6, 7, 8, 1]);
  });

  it("swaps two pool albums", () => {
    expect(ids(swapAlbums(all, "album-9", "album-7", none))).toEqual([1, 2, 3, 4, 5, 6, 9, 8, 7]);
  });

  it("swaps between the wall and the pool in either direction", () => {
    expect(ids(swapAlbums(all, "album-1", "album-8", none))).toEqual([8, 2, 3, 4, 5, 6, 7, 1, 9]);
    expect(ids(swapAlbums(all, "album-8", "album-3", none))).toEqual([1, 2, 8, 4, 5, 6, 7, 3, 9]);
  });

  it("never duplicates or loses an album", () => {
    const pairs: [string, string][] = [
      ["album-1", "album-8"],
      ["album-6", "album-9"],
      ["album-2", "album-5"],
    ];
    for (const [activeId, overId] of pairs) {
      const result = swapAlbums(all, activeId, overId, none);
      expect(result).toHaveLength(all.length);
      expect(ids(result)?.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    }
  });

  it("keeps pinned albums in place while others swap around them", () => {
    const pinned = new Set(["3", "4"]);
    expect(ids(swapAlbums(all, "album-6", "album-1", pinned))).toEqual([6, 2, 3, 4, 5, 1, 7, 8, 9]);
  });

  it("swaps nothing when the dragged album or its target is pinned", () => {
    const pinned = new Set(["2"]);
    expect(swapAlbums(all, "album-5", "album-2", pinned)).toBeNull();
    expect(swapAlbums(all, "album-2", "album-5", pinned)).toBeNull();
    expect(swapAlbums(all, "album-8", "album-2", pinned)).toBeNull();
  });

  it("swaps nothing when dropped on itself or on an unknown album", () => {
    expect(swapAlbums(all, "album-3", "album-3", none)).toBeNull();
    expect(swapAlbums(all, "album-3", "album-99", none)).toBeNull();
    expect(swapAlbums(all, "album-99", "album-3", none)).toBeNull();
  });

  it("does not modify the list it is given", () => {
    const copy = [...all];
    swapAlbums(all, "album-1", "album-8", none);
    expect(all).toEqual(copy);
  });
});
