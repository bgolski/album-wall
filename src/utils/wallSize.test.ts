import { describe, expect, it } from "vitest";
import { wallSize } from "./wallSize";

describe("wallSize", () => {
  it("writes columns across, then rows down", () => {
    expect(wallSize(8, 4)).toBe("8 \u00d7 4");
  });
});
