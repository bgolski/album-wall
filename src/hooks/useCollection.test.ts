import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCollection } from "./useCollection";
import type { Album } from "@/types";
import { encodeSharedWallState } from "@/utils/shareState";

// Mock the Discogs utility module.
vi.mock("@/utils/discogs", () => {
  return {
    getUserCollection: vi.fn(),
    validateDiscogsUsername: vi.fn(),
  };
});
import * as discogs from "@/utils/discogs";

const mockDiscogs = discogs as unknown as {
  getUserCollection: ReturnType<typeof vi.fn>;
  validateDiscogsUsername: ReturnType<typeof vi.fn>;
};

const VALIDATION_ERROR_MESSAGE =
  "Invalid username format. Use only letters, numbers, dots, underscores, or hyphens.";

describe("useCollection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads a collection successfully", async () => {
    mockDiscogs.validateDiscogsUsername.mockReturnValue(true);
    const mockAlbums = [{ id: 1, title: "Test Album" } as Album];
    mockDiscogs.getUserCollection.mockResolvedValue(mockAlbums);

    const { result } = renderHook(() => useCollection());

    act(() => {
      result.current.handleUsernameChange("validUser");
    });

    await act(async () => {
      await result.current.loadCollection();
    });

    await waitFor(() => expect(result.current.albums).toEqual(mockAlbums));
    expect(result.current.loadedUsername).toBe("validUser");
    expect(result.current.error).toBeNull();
    expect(result.current.usernameError).toBeNull();
  });

  it("sets validation error when username is invalid", async () => {
    mockDiscogs.validateDiscogsUsername.mockReturnValue(false);

    const { result } = renderHook(() => useCollection());

    act(() => {
      result.current.handleUsernameChange("bad@user");
    });

    await act(async () => {
      await result.current.loadCollection();
    });

    expect(result.current.usernameError).toBe(VALIDATION_ERROR_MESSAGE);
    expect(mockDiscogs.getUserCollection).not.toHaveBeenCalled();
  });

  it("sets error when getUserCollection rejects", async () => {
    mockDiscogs.validateDiscogsUsername.mockReturnValue(true);
    mockDiscogs.getUserCollection.mockRejectedValue(new Error("Not found"));

    const { result } = renderHook(() => useCollection());

    act(() => {
      result.current.handleUsernameChange("user");
    });

    await act(async () => {
      await result.current.loadCollection();
    });

    await waitFor(() => expect(result.current.error).toBe("Not found"));
    expect(result.current.albums).toEqual([]);
  });

  it("retries loading after a failure", async () => {
    mockDiscogs.validateDiscogsUsername.mockReturnValue(true);
    const mockAlbums = [{ id: 1, title: "Album" } as Album];
    mockDiscogs.getUserCollection
      .mockRejectedValueOnce(new Error("Not found"))
      .mockResolvedValueOnce(mockAlbums);

    const { result } = renderHook(() => useCollection());

    act(() => {
      result.current.handleUsernameChange("user");
    });

    // Initial load fails.
    await act(async () => {
      await result.current.loadCollection();
    });

    await waitFor(() => expect(result.current.error).toBe("Not found"));

    // Retry should succeed.
    act(() => {
      result.current.retry();
    });

    await waitFor(() => expect(result.current.albums).toEqual(mockAlbums));
    expect(result.current.error).toBeNull();
  });

  it("clears errors when the username changes", async () => {
    mockDiscogs.validateDiscogsUsername.mockReturnValue(true);
    mockDiscogs.getUserCollection.mockRejectedValue(new Error("Not found"));

    const { result } = renderHook(() => useCollection());

    act(() => {
      result.current.handleUsernameChange("user");
    });

    await act(async () => {
      await result.current.loadCollection();
    });

    await waitFor(() => expect(result.current.error).toBe("Not found"));

    act(() => {
      result.current.handleUsernameChange("another");
    });

    expect(result.current.error).toBeNull();
    expect(result.current.usernameError).toBeNull();
  });

  it("updates album order when reordered", () => {
    const initial = [{ id: 1 }, { id: 2 }] as Album[];
    const reordered = [{ id: 2 }, { id: 1 }] as Album[];

    const { result } = renderHook(() => useCollection());

    act(() => {
      result.current.handleAlbumsReorder(initial);
    });
    expect(result.current.albums).toEqual(initial);

    act(() => {
      result.current.handleAlbumsReorder(reordered);
    });
    expect(result.current.albums).toEqual(reordered);
  });
});

describe("useCollection memory", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockDiscogs.validateDiscogsUsername.mockReturnValue(true);
  });

  const albumsOf = (...ids: number[]) => ids.map((id) => ({ id, title: `T${id}`, artist: "A" }));

  async function load(result: { current: ReturnType<typeof useCollection> }, name = "user") {
    act(() => {
      result.current.handleUsernameChange(name);
    });
    await act(async () => {
      await result.current.loadCollection();
    });
  }

  it("reuses a collection loaded in the last ten minutes", async () => {
    mockDiscogs.getUserCollection.mockResolvedValue(albumsOf(1, 2));
    const first = renderHook(() => useCollection());
    await load(first.result);
    const second = renderHook(() => useCollection());
    await load(second.result, "USER");
    await waitFor(() => expect(second.result.current.albums.map((a) => a.id)).toEqual([1, 2]));
    expect(mockDiscogs.getUserCollection).toHaveBeenCalledTimes(1);
  });

  it("asks Discogs again on Retry", async () => {
    mockDiscogs.getUserCollection.mockResolvedValue(albumsOf(1, 2));
    const { result } = renderHook(() => useCollection());
    await load(result);
    await act(async () => {
      result.current.retry();
    });
    await waitFor(() => expect(mockDiscogs.getUserCollection).toHaveBeenCalledTimes(2));
  });

  it("restores the wall saved for that username and prefills the last username", async () => {
    mockDiscogs.getUserCollection.mockResolvedValue(albumsOf(1, 2, 3, 4));
    window.localStorage.setItem(
      "album-wall:wall:user",
      encodeSharedWallState({
        v: 1,
        username: "user",
        rows: 1,
        columns: 2,
        wallAlbumIds: ["3", "1"],
        pinnedAlbumIds: ["1"],
      })
    );
    const { result } = renderHook(() => useCollection());
    await load(result, "User");
    await waitFor(() => expect(result.current.albums.map((a) => a.id)).toEqual([3, 1, 2, 4]));
    expect(result.current.sharedWallState).toMatchObject({
      username: "User",
      rows: 1,
      columns: 2,
      pinnedAlbumIds: ["1"],
    });

    const later = renderHook(() => useCollection());
    expect(later.result.current.username).toBe("User");
  });

  it("undoes reorders newest first and forgets them on the next load", async () => {
    mockDiscogs.getUserCollection.mockResolvedValue(albumsOf(1, 2, 3));
    const { result } = renderHook(() => useCollection());
    await load(result);
    expect(result.current.canUndo).toBe(false);

    act(() => {
      result.current.handleAlbumsReorder(albumsOf(2, 1, 3));
    });
    act(() => {
      result.current.handleAlbumsReorder(albumsOf(3, 1, 2));
    });
    expect(result.current.canUndo).toBe(true);

    act(() => {
      expect(result.current.undo()).toBe(true);
    });
    expect(result.current.albums.map((a) => a.id)).toEqual([2, 1, 3]);

    await act(async () => {
      result.current.retry();
    });
    await waitFor(() => expect(result.current.canUndo).toBe(false));
    act(() => {
      expect(result.current.undo()).toBe(false);
    });
  });
});
