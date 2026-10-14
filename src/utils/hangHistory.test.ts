import { describe, expect, it } from "vitest";
import type { Album } from "@/types";
import {
  MAX_HANGS,
  addHang,
  hangHistoryKey,
  lastHung,
  localDay,
  mergeHangs,
  orderByRest,
  parseHangs,
  recentlyHungCost,
  serializeHangs,
} from "./hangHistory";

const day = (date: string) => new Date(`${date}T12:00:00`);

describe("hang history", () => {
  it("keys history by collection, ignoring case and spaces", () => {
    expect(hangHistoryKey(" BGolski ")).toBe("album-wall:hang-history:bgolski");
  });

  it("round-trips through storage and reads damaged text as no history", () => {
    const hangs = addHang([], ["1", "2"], day("2026-10-01"));
    expect(parseHangs(serializeHangs(hangs))).toEqual(hangs);
    expect(parseHangs("{")).toEqual([]);
    expect(parseHangs(JSON.stringify({ v: 2, hangs }))).toEqual([]);
    expect(
      parseHangs(JSON.stringify({ v: 1, hangs: [{ date: "yesterday", albumIds: [] }] }))
    ).toEqual([]);
  });

  it("uses the local day", () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("replaces the same day's record instead of counting a correction twice", () => {
    let hangs = addHang([], ["1"], day("2026-10-01"));
    hangs = addHang(hangs, ["2"], day("2026-10-01"));
    expect(hangs).toEqual([{ date: "2026-10-01", albumIds: ["2"] }]);
  });

  it("keeps only the most recent walls", () => {
    let hangs = addHang([], ["0"], day("2026-01-01"));
    for (let i = 1; i <= MAX_HANGS; i += 1) {
      hangs = addHang(hangs, [String(i)], new Date(2026, 1, i));
    }
    expect(hangs).toHaveLength(MAX_HANGS);
    expect(hangs[0]!.albumIds).toEqual(["1"]);
  });

  it("merges a backup, keeping the record already here for the same day", () => {
    const here = addHang([], ["1"], day("2026-10-02"));
    const merged = mergeHangs(here, [
      { date: "2026-10-02", albumIds: ["9"] },
      { date: "2026-09-01", albumIds: ["3"] },
      { date: "bad", albumIds: [] },
    ]);
    expect(merged).toEqual([
      { date: "2026-09-01", albumIds: ["3"] },
      { date: "2026-10-02", albumIds: ["1"] },
    ]);
  });

  it("knows when each album was last hung, and offers never-hung then longest-rested first", () => {
    const hangs = [
      { date: "2026-08-01", albumIds: ["1", "2"] },
      { date: "2026-10-01", albumIds: ["2", "3"] },
    ];
    const last = lastHung(hangs);
    expect(last.get("1")).toBe("2026-08-01");
    expect(last.get("2")).toBe("2026-10-01");
    const albums: Album[] = [1, 2, 3, 4, 5].map((id) => ({ id, title: "t", artist: "a" }));
    expect(orderByRest(albums, last).map((album) => album.id)).toEqual([4, 5, 1, 2, 3]);
  });

  it("charges recently hung albums more, halving for each older wall", () => {
    const cost = recentlyHungCost([
      { date: "2026-08-01", albumIds: ["1", "2"] },
      { date: "2026-10-01", albumIds: ["2"] },
    ]);
    expect(cost).toEqual({ "1": 0.04, "2": 0.08 });
  });
});
