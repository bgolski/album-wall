import { describe, it, expect } from "vitest";
import { swapAlbums } from "./dragAndDropHelpers";
import type { Album } from "@/types";

const createAlbum = (id: number): Album => ({ id, title: `Title ${id}`, artist: "artist" });
const albums = (...ids: number[]) => ids.map(createAlbum);
const ids = (list: Album[]) => list.map((album) => album.id);

describe("swapAlbums", () => {
  const wall = albums(1, 2, 3, 4, 5, 6);
  const pool = albums(7, 8, 9);
  const none = new Set<string>();

  it("swaps two wall albums and leaves every other slot in place", () => {
    const { newDisplayedAlbums, newPoolItems } = swapAlbums(wall, pool, "album-5", "album-2", none);
    expect(ids(newDisplayedAlbums)).toEqual([1, 5, 3, 4, 2, 6]);
    expect(ids(newPoolItems)).toEqual([7, 8, 9]);
  });

  it("swaps adjacent albums and the first and last slots", () => {
    expect(ids(swapAlbums(wall, pool, "album-1", "album-2", none).newDisplayedAlbums)).toEqual([
      2, 1, 3, 4, 5, 6,
    ]);
    expect(ids(swapAlbums(wall, pool, "album-6", "album-1", none).newDisplayedAlbums)).toEqual([
      6, 2, 3, 4, 5, 1,
    ]);
  });

  it("swaps two pool albums", () => {
    const { newDisplayedAlbums, newPoolItems } = swapAlbums(wall, pool, "album-9", "album-7", none);
    expect(ids(newDisplayedAlbums)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(ids(newPoolItems)).toEqual([9, 8, 7]);
  });

  it("swaps a wall album into the pool slot of the album it was dropped on", () => {
    const { newDisplayedAlbums, newPoolItems } = swapAlbums(
      albums(1, 2, 3),
      albums(4, 5),
      "album-1",
      "album-5",
      none
    );
    expect(ids(newDisplayedAlbums)).toEqual([5, 2, 3]);
    expect(ids(newPoolItems)).toEqual([4, 1]);
  });

  it("swaps a pool album into the wall slot of the album it was dropped on", () => {
    const { newDisplayedAlbums, newPoolItems } = swapAlbums(wall, pool, "album-8", "album-3", none);
    expect(ids(newDisplayedAlbums)).toEqual([1, 2, 8, 4, 5, 6]);
    expect(ids(newPoolItems)).toEqual([7, 3, 9]);
  });

  it("never duplicates or loses an album and keeps both list lengths", () => {
    const pairs = [
      ["album-1", "album-8"],
      ["album-8", "album-1"],
      ["album-6", "album-9"],
      ["album-2", "album-5"],
      ["album-7", "album-9"],
    ];
    for (const [activeId, overId] of pairs) {
      const { newDisplayedAlbums, newPoolItems } = swapAlbums(wall, pool, activeId, overId, none);
      expect(newDisplayedAlbums).toHaveLength(wall.length);
      expect(newPoolItems).toHaveLength(pool.length);
      expect([...ids(newDisplayedAlbums), ...ids(newPoolItems)].sort((a, b) => a - b)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9,
      ]);
    }
  });

  it("keeps pinned albums in their slots while others swap around them", () => {
    const pinned = new Set(["3", "4"]);
    const { newDisplayedAlbums } = swapAlbums(wall, pool, "album-6", "album-1", pinned);
    expect(ids(newDisplayedAlbums)).toEqual([6, 2, 3, 4, 5, 1]);
  });

  it("does nothing when the drop target or the dragged album is pinned", () => {
    const pinned = new Set(["2"]);
    for (const [activeId, overId] of [
      ["album-5", "album-2"],
      ["album-2", "album-5"],
      ["album-8", "album-2"],
    ]) {
      const result = swapAlbums(wall, pool, activeId, overId, pinned);
      expect(result.newDisplayedAlbums).toBe(wall);
      expect(result.newPoolItems).toBe(pool);
    }
  });

  it("does nothing when dropped on itself or on an unknown album", () => {
    for (const [activeId, overId] of [
      ["album-3", "album-3"],
      ["album-3", "album-99"],
      ["album-99", "album-3"],
    ]) {
      const result = swapAlbums(wall, pool, activeId, overId, none);
      expect(result.newDisplayedAlbums).toBe(wall);
      expect(result.newPoolItems).toBe(pool);
    }
  });

  it("does not modify the input arrays", () => {
    const wallCopy = [...wall];
    const poolCopy = [...pool];
    swapAlbums(wall, pool, "album-1", "album-8", none);
    expect(wall).toEqual(wallCopy);
    expect(pool).toEqual(poolCopy);
  });
});
