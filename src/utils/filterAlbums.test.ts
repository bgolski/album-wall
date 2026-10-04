import { describe, expect, it } from "vitest";
import { filterAlbums } from "./filterAlbums";
import type { Album } from "@/types";

const albums: Album[] = [
  { id: 1, title: "Blonde", artist: "Frank Ocean", year: "2016", genre: ["Electronic", "Soul"] },
  { id: 2, title: "Lemonade", artist: "Beyoncé", year: "2016", genre: ["Pop"] },
  { id: 3, title: "Abbey Road", artist: "The Beatles", year: "1969", genre: ["Rock"] },
  { id: 4, title: "Untitled", artist: "Unknown Artist" },
];

const ids = (list: Album[]) => list.map((album) => album.id);

describe("filterAlbums", () => {
  it("matches the title", () => {
    expect(ids(filterAlbums(albums, "abbey"))).toEqual([3]);
  });

  it("matches the artist", () => {
    expect(ids(filterAlbums(albums, "ocean"))).toEqual([1]);
  });

  it("matches the year", () => {
    expect(ids(filterAlbums(albums, "2016"))).toEqual([1, 2]);
  });

  it("matches any genre", () => {
    expect(ids(filterAlbums(albums, "soul"))).toEqual([1]);
    expect(ids(filterAlbums(albums, "electronic"))).toEqual([1]);
  });

  it("matches part of a word", () => {
    expect(ids(filterAlbums(albums, "beat"))).toEqual([3]);
  });

  it("requires every word to match, in any order and across fields", () => {
    expect(ids(filterAlbums(albums, "2016 pop"))).toEqual([2]);
    expect(ids(filterAlbums(albums, "ocean blonde"))).toEqual([1]);
    expect(ids(filterAlbums(albums, "blonde beatles"))).toEqual([]);
  });

  it("ignores case and surrounding or repeated spaces", () => {
    expect(ids(filterAlbums(albums, "  FRANK   ocean "))).toEqual([1]);
  });

  it("ignores accents in both the query and the album", () => {
    expect(ids(filterAlbums(albums, "beyonce"))).toEqual([2]);
    expect(ids(filterAlbums(albums, "BEYONCÉ"))).toEqual([2]);
  });

  it("returns the same array for a blank query", () => {
    expect(filterAlbums(albums, "")).toBe(albums);
    expect(filterAlbums(albums, "   ")).toBe(albums);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterAlbums(albums, "zzz")).toEqual([]);
  });

  it("keeps the original order and does not change the input", () => {
    const copy = [...albums];
    expect(ids(filterAlbums(albums, "e"))).toEqual([1, 2, 3, 4]);
    expect(albums).toEqual(copy);
  });

  it("copes with albums that have no year or genre", () => {
    expect(ids(filterAlbums(albums, "unknown"))).toEqual([4]);
  });
});
