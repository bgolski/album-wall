import { describe, expect, it } from "vitest";
import type { SharedWallState } from "@/types";
import { sameWall } from "./sameWall";

const wall = (over: Partial<SharedWallState> = {}): SharedWallState => ({
  v: 1,
  username: "someone",
  rows: 1,
  columns: 3,
  wallAlbumIds: ["1", "2", "3"],
  pinnedAlbumIds: ["2"],
  ...over,
});

describe("sameWall", () => {
  it("is true for the same albums in the same spots with the same pins", () => {
    expect(sameWall(wall(), wall())).toBe(true);
  });

  it("ignores the order pins were made in", () => {
    expect(
      sameWall(
        wall({ wallAlbumIds: ["1", "2", "3"], pinnedAlbumIds: ["3", "2"] }),
        wall({ wallAlbumIds: ["1", "2", "3"], pinnedAlbumIds: ["2", "3"] })
      )
    ).toBe(true);
  });

  it("is false when an album moves, or the size or the pins change", () => {
    expect(sameWall(wall(), wall({ wallAlbumIds: ["2", "1", "3"] }))).toBe(false);
    expect(sameWall(wall(), wall({ columns: 4, wallAlbumIds: ["1", "2", "3"] }))).toBe(false);
    expect(sameWall(wall(), wall({ pinnedAlbumIds: [] }))).toBe(false);
    expect(sameWall(wall(), wall({ pinnedAlbumIds: ["2", "3"] }))).toBe(false);
  });

  it("does not care which collection name the walls carry", () => {
    expect(sameWall(wall(), wall({ username: "another" }))).toBe(true);
  });
});
