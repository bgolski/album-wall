import { describe, expect, it } from "vitest";
import { loadFolderChoice, saveFolderChoice } from "./savedWall";

function memory() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

const refusing = {
  getItem: (): string | null => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

describe("folder choice", () => {
  it("is the whole collection (0) until a folder is chosen", () => {
    expect(loadFolderChoice(memory(), "someone")).toBe(0);
    expect(loadFolderChoice(null, "someone")).toBe(0);
  });

  it("remembers a folder per visitor under the existing key", () => {
    const storage = memory();
    saveFolderChoice(storage, "Someone", 7);
    expect(storage.items.get("album-wall:folder:Someone")).toBe("7");
    expect(loadFolderChoice(storage, "Someone")).toBe(7);
    expect(loadFolderChoice(storage, "other")).toBe(0);
  });

  it("forgets the choice when the whole collection is chosen again", () => {
    const storage = memory();
    saveFolderChoice(storage, "someone", 7);
    saveFolderChoice(storage, "someone", 0);
    expect(storage.items.has("album-wall:folder:someone")).toBe(false);
  });

  it("reads anything that is not a positive whole number as no choice", () => {
    for (const value of ["abc", "-3", "2.5", "0", ""]) {
      const storage = memory();
      storage.items.set("album-wall:folder:someone", value);
      expect(loadFolderChoice(storage, "someone")).toBe(0);
    }
  });

  it("never throws when storage is blocked", () => {
    expect(loadFolderChoice(refusing, "someone")).toBe(0);
    expect(() => saveFolderChoice(refusing, "someone", 7)).not.toThrow();
    expect(() => saveFolderChoice(null, "someone", 7)).not.toThrow();
  });
});
