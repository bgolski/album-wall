import { describe, expect, it } from "vitest";
import { albumKey, dragId } from "./albumKey";

describe("album keys", () => {
  it("names an album by its id as text, the form pins, saved walls and history use", () => {
    expect(albumKey({ id: 42 })).toBe("42");
  });

  it("gives each cover a drag id", () => {
    expect(dragId({ id: 42 })).toBe("album-42");
  });
});
