import { describe, expect, it } from "vitest";
import type { CoverColor } from "./colorBasics";
import type { CoverProfile } from "./coverProfile";
import {
  loadProfileCache,
  MAX_CACHED_PROFILES,
  PROFILE_CACHE_KEY,
  saveProfileCache,
} from "./colorCache";

function fakeStorage(initial: Record<string, string> = {}) {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
    removeItem: (key: string) => {
      delete data[key];
    },
  };
}

const color = (l: number): CoverColor => ({ l, a: 0.1, b: -0.05 });
const profile = (l: number): CoverProfile => ({
  color: color(l),
  palette: [
    { color: color(l), share: 0.7 },
    { color: color(0.1), share: 0.3 },
  ],
  regions: [
    color(l),
    null,
    color(0.2),
    color(0.3),
    color(0.4),
    color(0.5),
    color(0.6),
    color(0.7),
    color(0.8),
  ],
});

describe("profile cache", () => {
  it("round-trips profiles, rounded to four decimals, in order", () => {
    const storage = fakeStorage();
    const precise = { ...profile(0.5), color: { l: 0.123456789, a: 0.2, b: -0.3 } };
    expect(
      saveProfileCache(
        storage,
        new Map([
          ["https://x/a.jpg", precise],
          ["https://x/b.jpg", profile(0.9)],
        ])
      )
    ).toBe(true);
    const loaded = loadProfileCache(storage);
    expect([...loaded.keys()]).toEqual(["https://x/a.jpg", "https://x/b.jpg"]);
    expect(loaded.get("https://x/a.jpg")!.color).toEqual({ l: 0.1235, a: 0.2, b: -0.3 });
    expect(loaded.get("https://x/b.jpg")).toEqual(profile(0.9));
  });

  it("chooses the main color again by the current rule when reading a version 2 cache", () => {
    const cream = { l: 0.85, a: 0.004, b: 0.02 };
    const black = { l: 0.1, a: 0, b: 0.002 };
    const storage = fakeStorage();
    saveProfileCache(
      storage,
      new Map([
        [
          "u",
          {
            color: cream,
            palette: [
              { color: black, share: 0.6 },
              { color: cream, share: 0.4 },
            ],
            regions: Array(9).fill(black),
          },
        ],
      ])
    );
    expect(loadProfileCache(storage).get("u")!.color).toEqual(cream);
    const stored = JSON.parse(storage.data[PROFILE_CACHE_KEY]!);
    expect(stored.v).toBe(3);
    storage.data[PROFILE_CACHE_KEY] = JSON.stringify({ ...stored, v: 2 });
    expect(loadProfileCache(storage).get("u")!.color).toEqual(black);
  });

  it("clears the single colors earlier versions kept", () => {
    const storage = fakeStorage({ "album-wall:cover-colors": "{}" });
    saveProfileCache(storage, new Map([["u", profile(0.5)]]));
    expect(storage.data["album-wall:cover-colors"]).toBeUndefined();
  });

  it("starts empty for missing, damaged or unknown-version data", () => {
    expect(loadProfileCache(fakeStorage()).size).toBe(0);
    expect(loadProfileCache(fakeStorage({ [PROFILE_CACHE_KEY]: "nope" })).size).toBe(0);
    expect(loadProfileCache(fakeStorage({ [PROFILE_CACHE_KEY]: '{"v":1,"covers":{}}' })).size).toBe(
      0
    );
  });

  it("drops damaged entries and keeps good ones", () => {
    const storage = fakeStorage();
    saveProfileCache(storage, new Map([["good", profile(0.5)]]));
    const stored = JSON.parse(storage.data[PROFILE_CACHE_KEY]!);
    stored.covers.short = { c: [0.5, 0], p: [], r: [] };
    stored.covers.text = "x";
    stored.covers.fewRegions = { ...stored.covers.good, r: [null] };
    storage.data[PROFILE_CACHE_KEY] = JSON.stringify(stored);
    expect([...loadProfileCache(storage).keys()]).toEqual(["good"]);
  });

  it("keeps only the newest profiles once past the limit", () => {
    const profiles = new Map<string, CoverProfile>();
    for (let i = 0; i < MAX_CACHED_PROFILES + 5; i += 1) profiles.set(`u${i}`, profile(0.5));
    const storage = fakeStorage();
    saveProfileCache(storage, profiles);
    const loaded = loadProfileCache(storage);
    expect(loaded.size).toBe(MAX_CACHED_PROFILES);
    expect(loaded.has("u0")).toBe(false);
  });

  it("reports a refusal from storage instead of throwing", () => {
    const refusing = {
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(saveProfileCache(refusing, new Map([["u", profile(0.5)]]))).toBe(false);
    expect(
      loadProfileCache({
        getItem: () => {
          throw new Error("blocked");
        },
      }).size
    ).toBe(0);
  });
});
