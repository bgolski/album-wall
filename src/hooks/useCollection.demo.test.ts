import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useCollection } from "./useCollection";
import { getUserCollection, validateDiscogsUsername } from "@/utils/discogs";

vi.mock("@/utils/discogs", () => ({
  getUserCollection: vi.fn(),
  validateDiscogsUsername: vi.fn(() => true),
}));

const demoAlbums = [{ id: 900001, title: "Fictional record", artist: "Fictional artist" }];
const response = (value: unknown, ok = true) => ({
  ok,
  json: async () => value,
});

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("demo collection loading", () => {
  it("loads valid demo data without touching Discogs or saved username", async () => {
    window.localStorage.setItem("album-wall:last-username", "vinylfan");
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(response({ v: 1, albums: demoAlbums }) as Response);
    const { result } = renderHook(() => useCollection());
    await waitFor(() => expect(result.current.demoAvailable).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/\/demo\/collection\.json$/);

    act(() => result.current.loadDemo());
    await waitFor(() => expect(result.current.albums).toEqual(demoAlbums));
    expect(result.current.loadCount).toBe(1);
    expect(result.current.canUndo).toBe(false);
    expect(window.localStorage.getItem("album-wall:last-username")).toBe("vinylfan");
    expect(window.sessionStorage.length).toBe(0);
    expect(getUserCollection).not.toHaveBeenCalled();
  });

  it("does not offer the demo when the file is missing or invalid", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response(null, false) as Response);
    const missing = renderHook(() => useCollection());
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(missing.result.current.demoAvailable).toBe(false);
    missing.unmount();

    vi.mocked(fetch).mockResolvedValueOnce(response({ v: 2, albums: demoAlbums }) as Response);
    const invalid = renderHook(() => useCollection());
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(invalid.result.current.demoAvailable).toBe(false);
    expect(getUserCollection).not.toHaveBeenCalled();
  });

  it("still loads a normal Discogs username", async () => {
    vi.mocked(fetch).mockResolvedValue(response({ v: 1, albums: demoAlbums }) as Response);
    vi.mocked(getUserCollection).mockResolvedValue([{ id: 7, title: "Real", artist: "Artist" }]);
    vi.mocked(validateDiscogsUsername).mockReturnValue(true);
    const { result } = renderHook(() => useCollection());
    await waitFor(() => expect(result.current.demoAvailable).toBe(true));
    act(() => result.current.handleUsernameChange("vinylfan"));
    await act(async () => result.current.loadCollection());
    await waitFor(() => expect(result.current.loadedUsername).toBe("vinylfan"));
    expect(result.current.albums[0]?.id).toBe(7);
    expect(getUserCollection).toHaveBeenCalledWith("vinylfan");
  });
});
