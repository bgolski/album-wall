import { describe, expect, it } from "vitest";
import {
  forgetWall,
  loadLastUsername,
  loadSavedWall,
  saveLastUsername,
  saveWall,
  savedWallKey,
} from "./savedWall";
import { encodeSharedWallState } from "./shareState";
import type { SharedWallState } from "@/types";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
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
  removeItem: () => {
    throw new Error("blocked");
  },
};

const wall: SharedWallState = {
  v: 1,
  username: "VinylFan",
  rows: 3,
  columns: 4,
  wallAlbumIds: ["10", "20", "30"],
  pinnedAlbumIds: ["20"],
};

describe("savedWallKey", () => {
  it("is case-insensitive and ignores surrounding spaces", () => {
    expect(savedWallKey(" VinylFan ")).toBe("album-wall:wall:vinylfan");
    expect(savedWallKey("vinylfan")).toBe(savedWallKey("VINYLFAN"));
  });
});

describe("saveWall and loadSavedWall", () => {
  it("round-trips a wall under the user's key", () => {
    const storage = memoryStorage();
    expect(saveWall(storage, wall)).toBe(true);
    expect(storage.data.has("album-wall:wall:vinylfan")).toBe(true);
    expect(loadSavedWall(storage, "vinylfan")).toEqual(wall);
  });

  it("stores the same encoding a share link uses", () => {
    const storage = memoryStorage();
    saveWall(storage, wall);
    expect(storage.data.get("album-wall:wall:vinylfan")).toBe(encodeSharedWallState(wall));
  });

  it("returns null when nothing is saved for the user", () => {
    const storage = memoryStorage();
    saveWall(storage, wall);
    expect(loadSavedWall(storage, "someoneelse")).toBeNull();
  });

  it("returns null for a damaged entry", () => {
    const storage = memoryStorage({ "album-wall:wall:vinylfan": "not a wall" });
    expect(loadSavedWall(storage, "vinylfan")).toBeNull();
  });

  it("returns null when the saved wall belongs to a different user", () => {
    const other = encodeSharedWallState({ ...wall, username: "other" });
    const storage = memoryStorage({ "album-wall:wall:vinylfan": other });
    expect(loadSavedWall(storage, "vinylfan")).toBeNull();
  });

  it("survives storage that throws", () => {
    expect(saveWall(broken, wall)).toBe(false);
    expect(loadSavedWall(broken, "vinylfan")).toBeNull();
    expect(() => forgetWall(broken, "vinylfan")).not.toThrow();
  });
});

describe("forgetWall", () => {
  it("removes only that user's wall", () => {
    const storage = memoryStorage();
    saveWall(storage, wall);
    saveWall(storage, { ...wall, username: "other" });
    forgetWall(storage, "VINYLFAN");
    expect(loadSavedWall(storage, "vinylfan")).toBeNull();
    expect(loadSavedWall(storage, "other")).not.toBeNull();
  });
});

describe("last username", () => {
  it("round-trips the trimmed name", () => {
    const storage = memoryStorage();
    saveLastUsername(storage, "  VinylFan ");
    expect(storage.data.get("album-wall:last-username")).toBe("VinylFan");
    expect(loadLastUsername(storage)).toBe("VinylFan");
  });

  it("is null when unset, blank or unreadable", () => {
    expect(loadLastUsername(memoryStorage())).toBeNull();
    expect(loadLastUsername(memoryStorage({ "album-wall:last-username": "  " }))).toBeNull();
    expect(loadLastUsername(broken)).toBeNull();
    expect(() => saveLastUsername(broken, "VinylFan")).not.toThrow();
  });
});
