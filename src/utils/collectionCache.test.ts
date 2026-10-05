import { describe, expect, it } from "vitest";
import {
  COLLECTION_CACHE_MAX_AGE_MS,
  readCachedCollection,
  writeCachedCollection,
} from "./collectionCache";
import type { Album } from "@/types";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

const broken = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("quota");
  },
};

const albums: Album[] = [
  { id: 1, title: "Blonde", artist: "Frank Ocean", year: "2016", genre: ["Soul"] },
  { id: 2, title: "Abbey Road", artist: "The Beatles" },
];
const KEY = "album-wall:collection:vinylfan";
const NOW = 1_700_000_000_000;

describe("collection cache", () => {
  it("allows ten minutes by default", () => {
    expect(COLLECTION_CACHE_MAX_AGE_MS).toBe(10 * 60 * 1000);
  });

  it("round-trips a collection under a case-insensitive key", () => {
    const storage = memoryStorage();
    expect(writeCachedCollection(storage, " VinylFan ", albums, NOW)).toBe(true);
    expect(JSON.parse(storage.data.get(KEY) ?? "")).toEqual({ v: 1, savedAt: NOW, albums });
    expect(readCachedCollection(storage, "vinylfan", NOW + 1000)).toEqual(albums);
  });

  it("serves an entry until it is older than the maximum age", () => {
    const storage = memoryStorage();
    writeCachedCollection(storage, "vinylfan", albums, NOW);
    expect(readCachedCollection(storage, "vinylfan", NOW + COLLECTION_CACHE_MAX_AGE_MS)).toEqual(
      albums
    );
    expect(readCachedCollection(storage, "vinylfan", NOW + COLLECTION_CACHE_MAX_AGE_MS + 1)).toBe(
      null
    );
  });

  it("honours a custom maximum age", () => {
    const storage = memoryStorage();
    writeCachedCollection(storage, "vinylfan", albums, NOW);
    expect(readCachedCollection(storage, "vinylfan", NOW + 5000, 1000)).toBeNull();
  });

  it("ignores entries from the future", () => {
    const storage = memoryStorage();
    writeCachedCollection(storage, "vinylfan", albums, NOW);
    expect(readCachedCollection(storage, "vinylfan", NOW - 1)).toBeNull();
  });

  it("returns null when there is no entry for the user", () => {
    expect(readCachedCollection(memoryStorage(), "vinylfan", NOW)).toBeNull();
  });

  it("returns null for damaged entries", () => {
    for (const value of [
      "not json",
      JSON.stringify({ v: 2, savedAt: NOW, albums }),
      JSON.stringify({ v: 1, savedAt: "now", albums }),
      JSON.stringify({ v: 1, savedAt: NOW, albums: "none" }),
      JSON.stringify(null),
    ]) {
      expect(readCachedCollection(memoryStorage({ [KEY]: value }), "vinylfan", NOW)).toBeNull();
    }
  });

  it("survives storage that throws", () => {
    expect(writeCachedCollection(broken, "vinylfan", albums, NOW)).toBe(false);
    expect(readCachedCollection(broken, "vinylfan", NOW)).toBeNull();
  });
});
