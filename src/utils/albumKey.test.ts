import { describe, expect, it } from "vitest";
import { albumKey, albumKeyFromDragId, dragId } from "./albumKey";

describe("album keys", () => {
  it("names an album by its id as text, the form pins, saved walls and history use", () => {
    expect(albumKey({ id: 42 })).toBe("42");
  });

  it("gives each cover a drag id and reads the album back from it", () => {
    expect(dragId({ id: 42 })).toBe("album-42");
    expect(albumKeyFromDragId("album-42")).toBe("42");
    expect(albumKeyFromDragId(dragId({ id: 7 }))).toBe(albumKey({ id: 7 }));
  });

  it("reads nothing from an id that is not a cover's", () => {
    expect(albumKeyFromDragId("pool")).toBeNull();
    expect(albumKeyFromDragId("album-")).toBeNull();
    expect(albumKeyFromDragId(42)).toBeNull();
  });
});
