import { describe, expect, it } from "vitest";
import type { Album, SharedWallState } from "@/types/index";
import { countMissing, formatDay, wallOfHang, type HangRecord } from "./hangHistory";
import { hangChanges } from "./hangChanges";

const collection: Album[] = [1, 2, 3, 4, 5].map((id) => ({
  id,
  title: `Album ${id}`,
  artist: `Artist ${id}`,
}));

const wall = (rows: number, columns: number, ids: string[]): SharedWallState => ({
  v: 1,
  username: "someone",
  rows,
  columns,
  wallAlbumIds: ids,
  pinnedAlbumIds: [],
});

describe("wallOfHang", () => {
  it("puts back a wall with the shape it was recorded with", () => {
    const hang: HangRecord = { date: "2026-10-01", albumIds: ["1", "2", "3"], rows: 1, columns: 3 };
    expect(wallOfHang(hang, "someone", 5)).toEqual(wall(1, 3, ["1", "2", "3"]));
  });

  it("uses the fallback width for a wall recorded without a shape, with enough rows", () => {
    const hang: HangRecord = { date: "2026-10-01", albumIds: ["1", "2", "3", "4", "5"] };
    expect(wallOfHang(hang, "someone", 2)).toEqual(wall(3, 2, ["1", "2", "3", "4", "5"]));
  });

  it("keeps a recorded width and works out only the missing rows", () => {
    const hang: HangRecord = { date: "2026-10-01", albumIds: ["1", "2", "3", "4"], columns: 4 };
    expect(wallOfHang(hang, "someone", 2)).toEqual(wall(1, 4, ["1", "2", "3", "4"]));
  });

  it("has at least one row even for an empty wall", () => {
    expect(wallOfHang({ date: "2026-10-01", albumIds: [] }, "someone", 3).rows).toBe(1);
  });
});

describe("countMissing", () => {
  it("counts the ids that are no longer in the collection", () => {
    const byId = new Map(collection.map((album) => [String(album.id), album]));
    expect(countMissing(["1", "9", "2", "8"], byId)).toBe(2);
    expect(countMissing([], byId)).toBe(0);
  });
});

describe("hangChanges", () => {
  const hang: HangRecord = { date: "2026-10-01", albumIds: ["1", "2"], rows: 1, columns: 2 };

  it("is null with nothing hung yet, or when the wall is the one on the wall", () => {
    expect(hangChanges(undefined, wall(1, 2, ["1", "2"]), collection)).toBeNull();
    expect(hangChanges(hang, wall(1, 2, ["1", "2"]), collection)).toBeNull();
  });

  it("lists the steps from the last wall hung, naming places by row and column", () => {
    expect(hangChanges(hang, wall(1, 2, ["1", "3"]), collection)).toEqual({
      since: formatDay("2026-10-01"),
      lines: ["Replace Album 2 with Album 3 at R1 C2"],
    });
  });

  it("names an album that has left the collection", () => {
    const old: HangRecord = { date: "2026-10-01", albumIds: ["1", "9"], rows: 1, columns: 2 };
    expect(hangChanges(old, wall(1, 2, ["1", "3"]), collection)?.lines).toEqual([
      "Replace An album no longer in the collection with Album 3 at R1 C2",
    ]);
  });

  it("reads a wall recorded without a shape at the current wall's width", () => {
    const old: HangRecord = { date: "2026-10-01", albumIds: ["1", "2", "3", "4"] };
    expect(hangChanges(old, wall(2, 2, ["1", "2", "3", "5"]), collection)?.lines).toEqual([
      "Replace Album 4 with Album 5 at R2 C2",
    ]);
  });
});
