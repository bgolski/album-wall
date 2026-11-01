import { describe, expect, it } from "vitest";
import type { Album } from "@/types/index";
import { availableGroups, groupsOf } from "./groupModes";

function album(id: number, artist: string, extra: Partial<Album> = {}): Album {
  return { id, artist, title: `T${id}`, ...extra };
}

describe("groupsOf", () => {
  it("names an artist, genres with styles, or a decade", () => {
    const record = album(1, " Ash ", {
      genre: ["Rock"],
      styles: ["Hard Rock", "Rock"],
      year: "1977",
    });
    expect(groupsOf("artist", record)).toEqual(["Ash"]);
    expect(groupsOf("genre", record)).toEqual(["Rock", "Hard Rock"]);
    expect(groupsOf("year", record)).toEqual(["1970s"]);
  });

  it("gives no group to a record with no year, or Discogs' year 0", () => {
    expect(groupsOf("year", album(1, "a"))).toEqual([]);
    expect(groupsOf("year", album(1, "a", { year: "0" }))).toEqual([]);
  });
});

describe("availableGroups", () => {
  const records = [
    album(1, "Ash", { year: "1991" }),
    album(2, "Ash", { year: "1975" }),
    album(3, "Bee", { year: "1999" }),
  ];

  it("lists artists by how many records, biggest first", () => {
    expect(availableGroups("artist", records)).toEqual([
      { label: "Ash", count: 2 },
      { label: "Bee", count: 1 },
    ]);
  });

  it("lists decades oldest to newest", () => {
    expect(availableGroups("year", records).map((choice) => choice.label)).toEqual([
      "1970s",
      "1990s",
    ]);
  });
});
