import { describe, expect, it } from "vitest";
import type { SharedWallState } from "@/types";
import {
  addLayout,
  deleteLayout,
  exportBundle,
  importBundle,
  LayoutError,
  layoutsKey,
  MAX_LAYOUTS,
  parseLayouts,
  renameLayout,
  serializeLayouts,
  type SavedLayout,
} from "./layoutStore";

const wall = (username = "someone"): SharedWallState => ({
  v: 1,
  username,
  rows: 1,
  columns: 3,
  wallAlbumIds: ["11", "12", "13"],
  pinnedAlbumIds: ["12"],
});
const when = new Date("2026-10-13T12:00:00.000Z");

function layoutsNamed(names: string[]): SavedLayout[] {
  return names.reduce<SavedLayout[]>(
    (list, name, index) => addLayout(list, name, wall(), when, `id-${index}`),
    []
  );
}
const names = (list: SavedLayout[]) => list.map((layout) => layout.name);

describe("addLayout", () => {
  it("appends a layout with a trimmed name, the date and the wall", () => {
    const original: SavedLayout[] = [];
    const list = addLayout(original, "  Autumn  ", wall(), when, "abc");
    expect(original).toEqual([]);
    expect(list).toEqual([
      { v: 1, id: "abc", name: "Autumn", savedAt: "2026-10-13T12:00:00.000Z", wall: wall() },
    ]);
  });

  it("rejects an empty or blank name", () => {
    for (const name of ["", "   "]) {
      try {
        addLayout([], name, wall(), when, "x");
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(LayoutError);
        expect((error as LayoutError).code).toBe("empty-name");
      }
    }
  });

  it("makes names unique, ignoring case", () => {
    const list = layoutsNamed(["Autumn", "Autumn", "autumn", "Winter"]);
    expect(names(list)).toEqual(["Autumn", "Autumn 2", "autumn 3", "Winter"]);
  });

  it("refuses to go past the limit", () => {
    expect(MAX_LAYOUTS).toBe(20);
    const full = layoutsNamed(Array.from({ length: MAX_LAYOUTS }, (_, i) => `Layout ${i}`));
    try {
      addLayout(full, "One more", wall(), when, "late");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(LayoutError);
      expect((error as LayoutError).code).toBe("limit");
    }
  });
});

describe("parseLayouts and serializeLayouts", () => {
  it("round-trips a list", () => {
    const list = layoutsNamed(["Autumn", "Winter"]);
    expect(parseLayouts(serializeLayouts(list))).toEqual(list);
  });

  it("returns an empty list for missing, damaged or unknown-version data", () => {
    expect(parseLayouts(null)).toEqual([]);
    expect(parseLayouts("not json")).toEqual([]);
    expect(parseLayouts('{"v":2,"layouts":[]}')).toEqual([]);
    expect(parseLayouts('{"v":1}')).toEqual([]);
    expect(parseLayouts("[]")).toEqual([]);
  });

  it("drops damaged entries and keeps the rest", () => {
    const good = layoutsNamed(["Autumn"])[0]!;
    const raw = JSON.stringify({
      v: 1,
      layouts: [
        good,
        { ...good, id: "" },
        { ...good, id: "no-name", name: "" },
        { ...good, id: "bad-wall", wall: { ...good.wall, columns: "3" } },
        { ...good, id: "bad-ids", wall: { ...good.wall, wallAlbumIds: [1, 2] } },
        "nonsense",
        null,
      ],
    });
    expect(parseLayouts(raw)).toEqual([good]);
  });
});

describe("parseLayouts hardening", () => {
  it("drops a layout whose wall has no usable size", () => {
    const good = layoutsNamed(["Autumn"])[0]!;
    const raw = JSON.stringify({
      v: 1,
      layouts: [
        good,
        { ...good, id: "zero-columns", wall: { ...good.wall, columns: 0 } },
        { ...good, id: "fractional", wall: { ...good.wall, rows: 1.5 } },
        { ...good, id: "negative", wall: { ...good.wall, columns: -2 } },
      ],
    });
    expect(parseLayouts(raw)).toEqual([good]);
  });

  it("keeps only the first of two layouts with the same id", () => {
    const [first, second] = layoutsNamed(["Autumn", "Winter"]);
    const raw = JSON.stringify({ v: 1, layouts: [first, { ...second!, id: first!.id }] });
    expect(names(parseLayouts(raw))).toEqual(["Autumn"]);
  });
});

describe("renameLayout and deleteLayout", () => {
  it("renames a layout and keeps names unique", () => {
    const list = layoutsNamed(["Autumn", "Winter"]);
    expect(names(renameLayout(list, "id-1", "  Spring "))).toEqual(["Autumn", "Spring"]);
    expect(names(renameLayout(list, "id-1", "autumn"))).toEqual(["Autumn", "autumn 2"]);
    expect(names(renameLayout(list, "id-0", "Autumn"))).toEqual(["Autumn", "Winter"]);
  });

  it("rejects a blank new name and ignores an unknown id", () => {
    const list = layoutsNamed(["Autumn"]);
    expect(() => renameLayout(list, "id-0", " ")).toThrow(LayoutError);
    expect(renameLayout(list, "nope", "Spring")).toEqual(list);
  });

  it("deletes by id and ignores an unknown id", () => {
    const list = layoutsNamed(["Autumn", "Winter"]);
    expect(names(deleteLayout(list, "id-0"))).toEqual(["Winter"]);
    expect(deleteLayout(list, "nope")).toEqual(list);
    expect(list).toHaveLength(2);
  });
});

describe("exportBundle and importBundle", () => {
  it("restores an exported list into an empty one", () => {
    const list = layoutsNamed(["Autumn", "Winter"]);
    const result = importBundle([], exportBundle(list));
    expect(result).toEqual({ layouts: list, added: 2, skipped: 0 });
  });

  it("never overwrites a layout that has the same id", () => {
    const list = layoutsNamed(["Autumn", "Winter"]);
    const changed = renameLayout(list, "id-0", "Renamed");
    const result = importBundle(changed, exportBundle(list));
    expect(result.added).toBe(0);
    expect(result.skipped).toBe(2);
    expect(names(result.layouts)).toEqual(["Renamed", "Winter"]);
  });

  it("renames an imported layout whose name is taken by a different one", () => {
    const mine = addLayout([], "Autumn", wall(), when, "mine");
    const theirs = addLayout([], "Autumn", wall(), when, "theirs");
    const result = importBundle(mine, exportBundle(theirs));
    expect(result.added).toBe(1);
    expect(names(result.layouts)).toEqual(["Autumn", "Autumn 2"]);
  });

  it("stops at the limit and counts what it left out", () => {
    const existing = layoutsNamed(Array.from({ length: MAX_LAYOUTS - 1 }, (_, i) => `Mine ${i}`));
    const incoming = Array.from(
      { length: 3 },
      (_, i) => addLayout([], `Theirs ${i}`, wall(), when, `in-${i}`)[0]!
    );
    const result = importBundle(existing, exportBundle(incoming));
    expect(result.layouts).toHaveLength(MAX_LAYOUTS);
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(2);
  });

  it("counts damaged entries as skipped and rejects a file that is not a bundle", () => {
    const good = layoutsNamed(["Autumn"])[0]!;
    const raw = JSON.stringify({
      app: "album-wall",
      kind: "layouts",
      v: 1,
      layouts: [good, { id: "x" }],
    });
    const result = importBundle([], raw);
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(1);
    for (const bad of ["not json", "{}", '{"app":"other","kind":"layouts","v":1,"layouts":[]}']) {
      try {
        importBundle([], bad);
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(LayoutError);
        expect((error as LayoutError).code).toBe("invalid-file");
      }
    }
  });
});

describe("layoutsKey", () => {
  it("normalizes the collection name like a saved wall does", () => {
    expect(layoutsKey("  SomeOne ")).toBe("album-wall:layouts:someone");
  });
});
