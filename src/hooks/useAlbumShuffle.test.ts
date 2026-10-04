import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAlbumShuffle } from "@/hooks/useAlbumShuffle";
import { Album } from "@/types";

function createAlbum(id: number, title: string): Album {
  return { id, title, artist: "Artist" };
}

describe("useAlbumShuffle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("preserves pinned album positions and shuffles unpinned albums", () => {
    const displayed: Album[] = [createAlbum(1, "A"), createAlbum(2, "B"), createAlbum(3, "C")];
    const pool: Album[] = [createAlbum(4, "D"), createAlbum(5, "E")];
    const pinned = new Set<string>(["1"]);

    // Make randomness deterministic
    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const { result } = renderHook(() => useAlbumShuffle());
    const { newDisplayedAlbums, newPoolItems } = result.current.shuffleUnpinnedAlbums(
      displayed,
      pool,
      pinned
    );

    // Lengths should match originals
    expect(newDisplayedAlbums).toHaveLength(displayed.length);
    expect(newPoolItems).toHaveLength(pool.length);

    // Pinned album remains at original index
    expect(newDisplayedAlbums[0]!.id).toBe(1);

    // All albums appear exactly once across the new arrays
    const allIds = newDisplayedAlbums
      .concat(newPoolItems)
      .map((a) => a.id)
      .sort();
    const originalIds = displayed
      .concat(pool)
      .map((a) => a.id)
      .sort();
    expect(allIds).toEqual(originalIds);
  });

  it("returns unchanged arrays when all albums are pinned", () => {
    const displayed: Album[] = [createAlbum(1, "A"), createAlbum(2, "B")];
    const pool: Album[] = [];
    const pinned = new Set<string>(["1", "2"]);

    vi.spyOn(Math, "random").mockReturnValue(0.1);

    const { result } = renderHook(() => useAlbumShuffle());
    const { newDisplayedAlbums, newPoolItems } = result.current.shuffleUnpinnedAlbums(
      displayed,
      pool,
      pinned
    );

    expect(newDisplayedAlbums).toEqual(displayed);
    expect(newPoolItems).toEqual(pool);
  });
});
