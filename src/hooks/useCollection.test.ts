import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCollection } from "./useCollection";
import type { Album } from "@/types";

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
