import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAlbumSorting } from "./useAlbumSorting";

describe("useAlbumSorting", () => {
  it("starts by hand and remembers the mode chosen", () => {
    const { result } = renderHook(() => useAlbumSorting());
    expect(result.current.sortOption).toBe("none");
    act(() => result.current.handleSortChange("year"));
    expect(result.current.sortOption).toBe("year");
    act(() => result.current.handleSortChange("none"));
    expect(result.current.sortOption).toBe("none");
  });
});
