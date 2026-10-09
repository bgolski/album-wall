import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useCollection } from "./useCollection";
import { getUserCollection } from "@/utils/discogs";
import { DEMO_USERNAME } from "@/utils/demoCollection";
import { buildShareHash, buildSharedWallState, encodeSharedWallState } from "@/utils/shareState";
import { loadSavedWall, savedWallKey } from "@/utils/savedWall";

vi.mock("@/utils/discogs", async () => ({
  getUserCollection: vi.fn(),
  validateDiscogsUsername: (name: string) => /^[a-zA-Z0-9._-]{2,}$/.test(name.trim()),
}));

const demoAlbums = [1, 2, 3].map((id) => ({
  id,
  title: `Record ${id}`,
  artist: "Fictional artist",
}));
const demoFile = () => ({ ok: true, json: async () => ({ v: 1, albums: demoAlbums }) }) as Response;

const linkFor = (username: string, wallAlbumIds: string[], pinnedAlbumIds: string[] = []) =>
  buildShareHash(
    encodeSharedWallState(
      buildSharedWallState({ username, rows: 2, columns: 3, wallAlbumIds, pinnedAlbumIds })
    )
  );

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.location.hash = "";
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => demoFile())
  );
});
afterEach(() => {
  cleanup();
  window.location.hash = "";
  vi.unstubAllGlobals();
});

describe("demo wall sharing", () => {
  it("reserves a username Discogs cannot issue, so a real account never shares its saved wall", () => {
    expect(/^[a-zA-Z0-9._-]{2,}$/.test(DEMO_USERNAME)).toBe(false);
    expect(savedWallKey(DEMO_USERNAME)).not.toBe(savedWallKey("demo"));
  });

  it("reopens a demo share link with its order and pins, without contacting Discogs", async () => {
    window.location.hash = linkFor(DEMO_USERNAME, ["3", "1"], ["3"]);
    const { result } = renderHook(() => useCollection());
    await waitFor(() => expect(result.current.loadedUsername).toBe(DEMO_USERNAME));
    expect(result.current.albums.map((album) => album.id)).toEqual([3, 1, 2]);
    expect(result.current.sharedWallState?.pinnedAlbumIds).toEqual(["3"]);
    expect(result.current.username).toBe("");
    expect(getUserCollection).not.toHaveBeenCalled();
  });

  it("shows an error when a demo link is opened but the demo file is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false }) as Response)
    );
    window.location.hash = linkFor(DEMO_USERNAME, ["1"]);
    const { result } = renderHook(() => useCollection());
    await waitFor(() => expect(result.current.error).toMatch(/demo wall/i));
    expect(getUserCollection).not.toHaveBeenCalled();
  });

  it("restores the arrangement saved for the demo on this device", async () => {
    window.localStorage.setItem(
      savedWallKey(DEMO_USERNAME),
      encodeSharedWallState(
        buildSharedWallState({
          username: DEMO_USERNAME,
          rows: 1,
          columns: 3,
          wallAlbumIds: ["2", "3"],
          pinnedAlbumIds: [],
        })
      )
    );
    const { result } = renderHook(() => useCollection());
    await waitFor(() => expect(result.current.demoAvailable).toBe(true));
    act(() => result.current.loadDemo());
    expect(result.current.albums.map((album) => album.id)).toEqual([2, 3, 1]);
    expect(loadSavedWall(window.localStorage, "demo")).toBeNull();
  });

  it("still opens an ordinary Discogs share link through Discogs", async () => {
    vi.mocked(getUserCollection).mockResolvedValue(demoAlbums);
    window.location.hash = linkFor("vinylfan", ["2", "1"]);
    const { result } = renderHook(() => useCollection());
    await waitFor(() => expect(result.current.loadedUsername).toBe("vinylfan"));
    expect(getUserCollection).toHaveBeenCalledWith("vinylfan");
    expect(result.current.albums.map((album) => album.id)).toEqual([2, 1, 3]);
    expect(result.current.username).toBe("vinylfan");
  });
});
