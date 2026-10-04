import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAlbumSorting } from "./useAlbumSorting";
import type { Album } from "@/types";

function makeAlbum(id: number, artist: string, title: string, genre?: string[]): Album {
  return { id, artist, title, ...(genre ? { genre } : {}) };
}

describe("useAlbumSorting", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  describe("initial state", () => {
    it("sortOption defaults to 'none'", () => {
      const { result } = renderHook(() => useAlbumSorting());
      expect(result.current.sortOption).toBe("none");
    });

    it("sortAlbums returns albums unchanged when sortOption is 'none'", () => {
      const albums = [makeAlbum(1, "C", "Album C"), makeAlbum(2, "A", "Album A")];
      const { result } = renderHook(() => useAlbumSorting());
      const sorted = result.current.sortAlbums(albums, new Set());
      expect(sorted).toEqual(albums);
    });
  });

  describe("handleSortChange", () => {
    it("updates sortOption to 'artist'", () => {
      const { result } = renderHook(() => useAlbumSorting());
      act(() => {
        result.current.handleSortChange("artist");
      });
      expect(result.current.sortOption).toBe("artist");
    });

    it("updates sortOption to 'genre'", () => {
      const { result } = renderHook(() => useAlbumSorting());
      act(() => {
        result.current.handleSortChange("genre");
      });
      expect(result.current.sortOption).toBe("genre");
    });

    it("resets sortOption to 'none'", () => {
      const { result } = renderHook(() => useAlbumSorting());
      act(() => {
        result.current.handleSortChange("artist");
      });
      act(() => {
        result.current.handleSortChange("none");
      });
      expect(result.current.sortOption).toBe("none");
    });
  });

  describe("sort by artist", () => {
    it("sorts albums alphabetically by artist", () => {
      const albums = [
        makeAlbum(1, "Charlie", "Album C"),
        makeAlbum(2, "Alice", "Album A"),
        makeAlbum(3, "Bob", "Album B"),
      ];
      const { result } = renderHook(() => useAlbumSorting());
      act(() => {
        result.current.handleSortChange("artist");
      });
      const sorted = result.current.sortAlbums(albums, new Set());
      expect(sorted.map((a) => a.artist)).toEqual(["Alice", "Bob", "Charlie"]);
    });

    it("treats missing artist as empty string", () => {
      const albumNoArtist: Album = { id: 1, artist: "", title: "No Artist" };
      const albumWithArtist = makeAlbum(2, "Zebra", "Album Z");
      const { result } = renderHook(() => useAlbumSorting());
      act(() => {
        result.current.handleSortChange("artist");
      });
      const sorted = result.current.sortAlbums([albumNoArtist, albumWithArtist], new Set());
      expect(sorted[0]!.title).toBe("No Artist");
    });

    it("ties preserve original order (stable sort)", () => {
      const albums = [makeAlbum(1, "Aaa", "First"), makeAlbum(2, "Aaa", "Second")];
      const { result } = renderHook(() => useAlbumSorting());
      act(() => {
        result.current.handleSortChange("artist");
      });
      const sorted = result.current.sortAlbums(albums, new Set());
      expect(sorted[0]!.title).toBe("First");
      expect(sorted[1]!.title).toBe("Second");
    });
  });

  describe("sort by genre", () => {
    it("sorts albums by first genre", () => {
      const albums = [
        makeAlbum(1, "Artist A", "Album 1", ["Rock", "Pop"]),
        makeAlbum(2, "Artist B", "Album 2", ["Jazz"]),
        makeAlbum(3, "Artist C", "Album 3", ["Blues"]),
      ];
      const { result } = renderHook(() => useAlbumSorting());
      act(() => {
        result.current.handleSortChange("genre");
      });
      const sorted = result.current.sortAlbums(albums, new Set());
      expect(sorted.map((a) => a.title)).toEqual(["Album 3", "Album 2", "Album 1"]);
    });

    it("treats missing genre as empty string", () => {
      const albumNoGenre: Album = { id: 1, artist: "A", title: "No Genre" };
      const albumWithGenre = makeAlbum(2, "B", "Has Genre", ["Rock"]);
      const { result } = renderHook(() => useAlbumSorting());
      act(() => {
        result.current.handleSortChange("genre");
      });
      const sorted = result.current.sortAlbums([albumNoGenre, albumWithGenre], new Set());
      expect(sorted[0]!.title).toBe("No Genre");
    });

    it("treats empty genre array as empty string", () => {
      const album: Album = { id: 1, artist: "A", title: "Empty Genre", genre: [] };
      const albumWithGenre = makeAlbum(2, "B", "Has Genre", ["Rock"]);
      const { result } = renderHook(() => useAlbumSorting());
      act(() => {
        result.current.handleSortChange("genre");
      });
      const sorted = result.current.sortAlbums([album, albumWithGenre], new Set());
      expect(sorted[0]!.title).toBe("Empty Genre");
    });
  });

  describe("pinned albums", () => {
    it("keeps pinned albums in place during artist sort", () => {
      const albums = [
        makeAlbum(1, "Alice", "Pinned"),
        makeAlbum(2, "Charlie", "Unpinned 1"),
        makeAlbum(3, "Bob", "Unpinned 2"),
      ];
      const pinned = new Set(["1"]);
      const { result } = renderHook(() => useAlbumSorting());
      act(() => {
        result.current.handleSortChange("artist");
      });
      const sorted = result.current.sortAlbums(albums, pinned);
      expect(sorted[0]!.id).toBe(1);
      expect(sorted[1]!.id).toBe(3);
      expect(sorted[2]!.id).toBe(2);
    });

    it("keeps pinned albums in place during genre sort", () => {
      const albums = [
        makeAlbum(1, "A", "Pinned", ["Rock"]),
        makeAlbum(2, "B", "Unpinned 1", ["Blues"]),
        makeAlbum(3, "C", "Unpinned 2", ["Jazz"]),
      ];
      const pinned = new Set(["1", "3"]);
      const { result } = renderHook(() => useAlbumSorting());
      act(() => {
        result.current.handleSortChange("genre");
      });
      const sorted = result.current.sortAlbums(albums, pinned);
      expect(sorted[0]!.id).toBe(1);
      expect(sorted[1]!.id).toBe(2);
      expect(sorted[2]!.id).toBe(3);
    });

    it("returns albums unchanged when pinned and sortOption is 'none'", () => {
      const albums = [makeAlbum(1, "C", "C"), makeAlbum(2, "A", "A")];
      const pinned = new Set(["1"]);
      const { result } = renderHook(() => useAlbumSorting());
      const sorted = result.current.sortAlbums(albums, pinned);
      expect(sorted).toEqual(albums);
    });

    it("handles all albums pinned", () => {
      const albums = [makeAlbum(1, "Charlie", "C"), makeAlbum(2, "Alice", "A")];
      const pinned = new Set(["1", "2"]);
      const { result } = renderHook(() => useAlbumSorting());
      act(() => {
        result.current.handleSortChange("artist");
      });
      const sorted = result.current.sortAlbums(albums, pinned);
      expect(sorted.map((a) => a.id)).toEqual([1, 2]);
    });

    it("handles no pinned albums", () => {
      const albums = [makeAlbum(1, "Charlie", "C"), makeAlbum(2, "Alice", "A")];
      const pinned = new Set<string>();
      const { result } = renderHook(() => useAlbumSorting());
      act(() => {
        result.current.handleSortChange("artist");
      });
      const sorted = result.current.sortAlbums(albums, pinned);
      expect(sorted.map((a) => a.id)).toEqual([2, 1]);
    });
  });
});
