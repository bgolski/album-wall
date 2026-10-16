import { describe, expect, it } from "vitest";
import type { Album } from "@/types";
import { buildGroupWall } from "./buildGroupWall";
import { groupPlan, type GroupSettings } from "@/components/arrange/groupModes";

function album(id: number, artist: string, extra: Partial<Album> = {}): Album {
  return { id, artist, title: `Title ${String(id).padStart(3, "0")}`, ...extra };
}

function run(albums: Album[], settings: Partial<GroupSettings>, pinned = new Set<string>()) {
  return buildGroupWall({
    albums,
    rows: 2,
    columns: 4,
    pinned,
    ...groupPlan({ mode: "genre", groups: [], aToZ: false, ...settings }),
  });
}

describe("buildGroupWall", () => {
  // Three genres of four records each, mixed up in the collection.
  const collection = Array.from({ length: 12 }, (_, at) =>
    album(at + 1, `Artist ${at}`, { genre: [["Rock", "Jazz", "Blues"][at % 3]!] })
  );
  const genreAt = (built: Album[], column: number) =>
    new Set(
      built
        .slice(0, 8)
        .filter((_, at) => at % 4 === column)
        .map((a) => a.genre![0])
    );

  it("runs the chosen groups in order from left to right", () => {
    const built = run(collection, { groups: ["Blues", "Jazz"] });
    expect(genreAt(built.albums, 0)).toEqual(new Set(["Blues"]));
    expect(genreAt(built.albums, 1)).toEqual(new Set(["Blues"]));
    expect(genreAt(built.albums, 2)).toEqual(new Set(["Jazz"]));
    expect(genreAt(built.albums, 3)).toEqual(new Set(["Jazz"]));
    expect(built.chosen).toBe(8);
    expect(built.others).toBe(0);
  });

  it("fills with other records, after the chosen ones, when the groups run out", () => {
    const built = run(collection, { groups: ["Jazz"] });
    expect(built.chosen).toBe(4);
    expect(built.others).toBe(4);
    expect(genreAt(built.albums, 0)).toEqual(new Set(["Jazz"]));
    expect(genreAt(built.albums, 1)).toEqual(new Set(["Jazz"]));
  });

  it("takes an even share from along the run when the groups hold more than the wall", () => {
    const many = Array.from({ length: 40 }, (_, at) =>
      album(at + 1, "Ash", { year: String(1960 + at) })
    );
    const built = run(many, {
      mode: "year",
      groups: ["1960s", "1970s", "1980s", "1990s"],
    });
    const years = built.albums.slice(0, 8).map((a) => Number(a.year));
    expect(years.filter((_, at) => at % 4 === 0).every((year) => year < 1975)).toBe(true);
    expect(years.filter((_, at) => at % 4 === 3).every((year) => year >= 1985)).toBe(true);
  });

  it("keeps pinned records where they are and does not use them again", () => {
    const pinnedId = collection[0]!.id;
    const built = run(
      collection,
      { groups: ["Blues", "Jazz", "Rock"] },
      new Set([String(pinnedId)])
    );
    expect(built.albums[0]!.id).toBe(pinnedId);
    expect(built.albums.filter((a) => a.id === pinnedId)).toHaveLength(1);
    expect(built.albums).toHaveLength(collection.length);
  });

  it("returns the collection unchanged when there is no wall", () => {
    expect(run([], { aToZ: true }).albums).toEqual([]);
  });
});

describe("the A to Z view", () => {
  it("shows the first wall's worth of the whole collection sorted, row by row", () => {
    const albums = [5, 3, 9, 1, 7, 2, 8, 4, 6, 10].map((id) =>
      album(id, String.fromCharCode(96 + id))
    );
    const built = run(albums, { mode: "artist", aToZ: true });
    expect(built.albums.slice(0, 8).map((a) => a.artist)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "g",
      "h",
    ]);
  });
});
