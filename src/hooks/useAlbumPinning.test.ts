import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAlbumPinning } from "./useAlbumPinning";
import { Album } from "../types";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const sampleAlbums = (ids: number[]): Album[] =>
  ids.map((id) => ({ id, title: `Album ${id}`, artist: "Artist" }));

describe("useAlbumPinning", () => {
  it("initializes with provided pinned ids", () => {
    const { result } = renderHook(() => useAlbumPinning(["1", "2"]));
    expect(result.current.pinnedAlbums.size).toBe(2);
    expect(result.current.pinnedAlbums.has("1")).toBe(true);
    expect(result.current.pinnedAlbums.has("3")).toBe(false);
  });

  it("toggles pin state for a single album", () => {
    const { result } = renderHook(() => useAlbumPinning(["1"]));
    act(() => {
      result.current.togglePinAlbum("1");
    });
    expect(result.current.pinnedAlbums.has("1")).toBe(false);
    act(() => {
      result.current.togglePinAlbum("2");
    });
    expect(result.current.pinnedAlbums.has("2")).toBe(true);
  });

  it("pin all and unpin all logic works correctly", () => {
    const displayed = sampleAlbums([1, 2]);
    const { result } = renderHook(() => useAlbumPinning());

    // Initially none pinned
    act(() => {
      result.current.togglePinAll(displayed);
    });
    expect(result.current.pinnedAlbums.has("1")).toBe(true);
    expect(result.current.pinnedAlbums.has("2")).toBe(true);

    // All pinned now; toggling again should unpin both
    act(() => {
      result.current.togglePinAll(displayed);
    });
    expect(result.current.pinnedAlbums.has("1")).toBe(false);
    expect(result.current.pinnedAlbums.has("2")).toBe(false);
  });

  it("removes specific pinned albums", () => {
    const { result } = renderHook(() => useAlbumPinning(["1", "2"]));
    act(() => {
      result.current.removePinsForAlbums(["1"]);
    });
    expect(result.current.pinnedAlbums.has("1")).toBe(false);
    expect(result.current.pinnedAlbums.has("2")).toBe(true);
  });

  it("replaces the full pinned set", () => {
    const { result } = renderHook(() => useAlbumPinning(["1"]));
    act(() => {
      result.current.replacePinnedAlbums(["3", "4"]);
    });
    expect(result.current.pinnedAlbums.size).toBe(2);
    expect(result.current.pinnedAlbums.has("3")).toBe(true);
    expect(result.current.pinnedAlbums.has("1")).toBe(false);
  });

  it("reports whether all displayed albums are pinned", () => {
    const displayed = sampleAlbums([1, 2]);
    const { result } = renderHook(() => useAlbumPinning(["1"]));

    // Not all pinned
    expect(result.current.areAllPinned(displayed)).toBe(false);

    act(() => {
      result.current.togglePinAlbum("2");
    });
    expect(result.current.areAllPinned(displayed)).toBe(true);

    // If displayed is empty, should be false
    expect(result.current.areAllPinned([])).toBe(false);
  });
});
