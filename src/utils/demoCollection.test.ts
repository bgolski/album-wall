import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDemoCollection } from "./demoCollection";

const album = { id: 1, title: "Fictional record", artist: "Fictional artist" };

describe("parseDemoCollection", () => {
  it("accepts the committed demo collection", () => {
    const fixture = JSON.parse(readFileSync("public/demo/collection.json", "utf8"));
    const result = parseDemoCollection(fixture);
    expect(result?.length).toBeGreaterThanOrEqual(90);
    expect(result).toHaveLength(fixture.albums.length);
    expect(new Set(result?.map((item) => item.id)).size).toBe(result?.length);
    expect(
      result?.every((item) =>
        item.cover_image?.startsWith("https://coverartarchive.org/release-group/")
      )
    ).toBe(true);
    expect(result?.every((item) => item.genre?.length && item.year)).toBe(true);
  });

  it("rejects invalid envelopes", () => {
    expect(parseDemoCollection(null)).toBeNull();
    expect(parseDemoCollection([])).toBeNull();
    expect(parseDemoCollection({ v: 2, albums: [album] })).toBeNull();
    expect(parseDemoCollection({ v: 1, albums: "wrong" })).toBeNull();
    expect(parseDemoCollection({ v: 1, albums: [] })).toBeNull();
  });

  it("filters malformed and duplicate records while preserving valid optional fields", () => {
    const valid = {
      ...album,
      genre: ["Electronic"],
      cover_image: "data:image/svg+xml;base64,AA==",
    };
    const result = parseDemoCollection({
      v: 1,
      albums: [
        valid,
        { ...album, title: "Duplicate" },
        { ...album, id: 0 },
        { ...album, id: -1 },
        { ...album, id: 1.5 },
        { ...album, id: Number.MAX_SAFE_INTEGER + 1 },
        { ...album, id: "2" },
        { ...album, id: 2, title: " " },
        { ...album, id: 3, artist: "" },
        { ...album, id: 4, title: "Second" },
      ],
    });
    expect(result).toEqual([valid, { ...album, id: 4, title: "Second" }]);
  });

  it("returns null when no usable albums survive", () => {
    expect(parseDemoCollection({ v: 1, albums: [null, {}, { ...album, id: NaN }] })).toBeNull();
  });
});
