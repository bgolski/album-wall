import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useCollection } from "./useCollection";
import { getUserCollection } from "@/collection/discogs";
import { DiscogsProxyError } from "@/account/discogsSignIn";
import { buildShareHash, buildSharedWallState, encodeSharedWallState } from "@/share/shareState";

vi.mock("@/collection/discogs", async () => ({
  getUserCollection: vi.fn(),
  validateDiscogsUsername: (name: string) => /^[a-zA-Z0-9._-]{2,}$/.test(name.trim()),
}));

const SESSION = { username: "Collector", token: "accesstoken", secret: "accesssecret" };
const albums = [{ id: 1, title: "One", artist: "A" }];

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.location.hash = "";
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: false }) as Response)
  );
});
afterEach(() => {
  cleanup();
  window.location.hash = "";
  vi.unstubAllGlobals();
});

describe("signed in with Discogs", () => {
  it("loads the visitor's own collection with their sign-in, then a chosen folder", async () => {
    vi.mocked(getUserCollection).mockResolvedValue(albums);
    const { result } = renderHook(() => useCollection(SESSION));

    act(() => void result.current.loadCollection("Collector"));
    await waitFor(() => expect(result.current.loadedUsername).toBe("Collector"));
    expect(getUserCollection).toHaveBeenLastCalledWith("Collector", undefined, {
      session: SESSION,
      folderId: 0,
    });

    act(() => result.current.chooseFolder(7));
    await waitFor(() =>
      expect(getUserCollection).toHaveBeenLastCalledWith("Collector", undefined, {
        session: SESSION,
        folderId: 7,
      })
    );
    expect(result.current.folderId).toBe(7);
    // Remembered on this device, and the folder has its own recently loaded copy.
    expect(localStorage.getItem("album-wall:folder:collector")).toBe("7");
    await waitFor(() =>
      expect(sessionStorage.getItem("album-wall:collection:collector#7")).not.toBeNull()
    );
  });

  it("does not load someone else's collection from the visitor's folder", async () => {
    vi.mocked(getUserCollection).mockResolvedValue(albums);
    localStorage.setItem("album-wall:folder:collector", "7");
    const { result } = renderHook(() => useCollection(SESSION));
    act(() => result.current.handleUsernameChange("someone"));
    await act(() => result.current.loadCollection());
    await waitFor(() => expect(result.current.loadedUsername).toBe("someone"));
    expect(getUserCollection).toHaveBeenLastCalledWith("someone", undefined, {
      session: SESSION,
      folderId: 0,
    });
  });

  it("signs out when Discogs no longer accepts the sign-in", async () => {
    vi.mocked(getUserCollection).mockRejectedValue(
      new DiscogsProxyError("ended", 401, "signed-out")
    );
    const onSignedOut = vi.fn();
    const { result } = renderHook(() => useCollection(SESSION, onSignedOut));
    act(() => void result.current.loadCollection("Collector"));
    await waitFor(() => expect(result.current.error?.message).toMatch(/signed out/i));
    expect(onSignedOut).toHaveBeenCalledTimes(1);
  });
});

describe("signed out", () => {
  it("keeps the shared-token call unchanged", async () => {
    vi.mocked(getUserCollection).mockResolvedValue(albums);
    const { result } = renderHook(() => useCollection());
    act(() => result.current.handleUsernameChange("someone"));
    await act(() => result.current.loadCollection());
    await waitFor(() => expect(result.current.loadedUsername).toBe("someone"));
    expect(getUserCollection).toHaveBeenCalledWith("someone");
  });

  it("explains a shared wall from a private collection", async () => {
    vi.mocked(getUserCollection).mockRejectedValue(
      new DiscogsProxyError("private on Discogs", 403, "private")
    );
    window.location.hash = buildShareHash(
      encodeSharedWallState(
        buildSharedWallState({
          username: "owner",
          rows: 1,
          columns: 1,
          wallAlbumIds: ["1"],
          pinnedAlbumIds: [],
        })
      )
    );
    const { result } = renderHook(() => useCollection());
    await waitFor(() => expect(result.current.error?.kind).toBe("private-shared"));
    expect(result.current.error?.message).toMatch(/shared from a private Discogs collection/);
  });

  it("marks a private collection typed by hand", async () => {
    vi.mocked(getUserCollection).mockRejectedValue(
      new DiscogsProxyError("The collection is private", 403, "private")
    );
    const { result } = renderHook(() => useCollection());
    act(() => result.current.handleUsernameChange("owner"));
    await act(() => result.current.loadCollection());
    await waitFor(() => expect(result.current.error?.kind).toBe("private"));
    expect(result.current.error?.message).toBe("The collection is private");
  });
});
