import { describe, it, expect } from "vitest";
import { getContainerType, reorderWithinGrid, swapBetweenContainers } from "./dragAndDropHelpers";
import type { Album } from "@/types";
import type { UniqueIdentifier } from "@dnd-kit/core";

// Helper to create an Album without a pinned property
const createAlbum = (id: number, title: string): Album => ({
  id,
  title,
  artist: "artist",
});

describe("dragAndDropHelpers", () => {
  // ========================= getContainerType =========================
  it("returns 'grid' when id matches an album in displayedAlbums", () => {
    const albums: Album[] = [createAlbum(1, "A"), createAlbum(2, "B")];
    const id = "album-1" as UniqueIdentifier;
    expect(getContainerType(id, albums)).toBe("grid");
  });

  it("returns 'pool' when id does not match any album", () => {
    const albums: Album[] = [createAlbum(1, "A"), createAlbum(2, "B")];
    const id = "album-999" as UniqueIdentifier;
    expect(getContainerType(id, albums)).toBe("pool");
  });

  // ========================= reorderWithinGrid =========================
  const albumList = [
    createAlbum(1, "A"),
    createAlbum(2, "B"),
    createAlbum(3, "C"),
    createAlbum(4, "D"),
  ];

  it("reorders unpinned albums when no pins", () => {
    const result = reorderWithinGrid(albumList, "2", "4", new Set<string>());
    expect(result.map((a) => a.id)).toEqual([1, 3, 4, 2]);
  });

  it("preserves pinned albums and reorders only unpinned", () => {
    const pinnedSet = new Set<string>(["1"]);
    const result = reorderWithinGrid(albumList, "2", "4", pinnedSet);
    expect(result[0].id).toBe(1);
    expect(result.slice(1).map((a) => a.id)).toEqual([3, 4, 2]);
  });

  it("ignores move when active album is pinned", () => {
    const pinnedSet = new Set<string>(["3"]);
    const result = reorderWithinGrid(albumList, "3", "4", pinnedSet);
    expect(result.map((a) => a.id)).toEqual([1, 2, 3, 4]);
  });

  // ========================= swapBetweenContainers =========================
  const gridAlbums = [createAlbum(1, "A"), createAlbum(2, "B"), createAlbum(3, "C")];
  const poolItems = [createAlbum(4, "D"), createAlbum(5, "E")];

  it("moves from grid to pool respecting pinned", () => {
    const pinnedSet = new Set<string>(["2"]);
    const { newDisplayedAlbums, newPoolItems } = swapBetweenContainers(
      gridAlbums,
      poolItems,
      0,
      1,
      "grid",
      "pool",
      pinnedSet
    );
    expect(newDisplayedAlbums.map((a) => a.id)).toEqual([2, 5, 3]);
    expect(newPoolItems.map((a) => a.id)).toEqual([4, 1, 5]);
  });

  it("moves from pool to grid normally", () => {
    const pinnedSet = new Set<string>();
    const { newDisplayedAlbums, newPoolItems } = swapBetweenContainers(
      gridAlbums,
      poolItems,
      0,
      1,
      "pool",
      "grid",
      pinnedSet
    );
    expect(newDisplayedAlbums.map((a) => a.id)).toEqual([1, 4, 2, 3]);
    expect(newPoolItems.map((a) => a.id)).toEqual([5]);
  });

  it("does not replace pinned grid album; inserts next available spot", () => {
    const pinnedSet = new Set<string>(["2"]);
    const { newDisplayedAlbums, newPoolItems } = swapBetweenContainers(
      gridAlbums,
      poolItems,
      0,
      1,
      "pool",
      "grid",
      pinnedSet
    );
    expect(newDisplayedAlbums.map((a) => a.id)).toEqual([1, 2, 4, 3]);
    expect(newPoolItems.map((a) => a.id)).toEqual([5]);
  });
});
