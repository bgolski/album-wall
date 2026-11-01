import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { SavedWallsContext } from "./savedWallsContext";
import { syncMarkerKey } from "./useAccountSync";
import { useLayouts } from "./useLayouts";
import { useHangHistory } from "./useHangHistory";
import { layoutsKey, serializeLayouts, type SavedLayout } from "@/wall/layoutStore";
import { hangHistoryKey } from "@/wall/hangHistory";
import type { SavedEntry, SavedKind, SavedWallsClient } from "@/account/savedWalls";
import type { SharedWallState } from "@/types";

const wall: SharedWallState = {
  v: 1,
  username: "bgolski",
  rows: 1,
  columns: 2,
  wallAlbumIds: ["1", "2"],
  pinnedAlbumIds: [],
};
const layout = (id: string, savedAt: string, name = id): SavedLayout => ({
  v: 1,
  id,
  name,
  savedAt,
  wall,
});

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

function fakeClient(saved: Partial<Record<SavedKind, SavedEntry | null>> = {}) {
  let resolveLoad: () => void = () => {};
  const loaded = new Promise<void>((resolve) => (resolveLoad = resolve));
  const client = {
    account: "bgolski",
    load: vi.fn(async () => {
      await loaded;
      return { layouts: saved.layouts ?? null, history: saved.history ?? null };
    }),
    save: vi.fn(async () => "2026-10-15T10:00:00.000Z"),
    removeAll: vi.fn(async () => 0),
  } satisfies SavedWallsClient;
  return { client, resolveLoad };
}

const wrapper = (client: SavedWallsClient | null) =>
  function Provider({ children }: { children: ReactNode }) {
    return <SavedWallsContext.Provider value={client}>{children}</SavedWallsContext.Provider>;
  };
const marker = (storage: ReturnType<typeof memoryStorage>, kind: SavedKind = "layouts") =>
  JSON.parse(storage.data.get(syncMarkerKey("bgolski", kind, "bgolski")) ?? "null");

describe("saved walls in the account", () => {
  it("does nothing signed out", () => {
    const storage = memoryStorage();
    const { result } = renderHook(() => useLayouts("bgolski", { storage }), {
      wrapper: wrapper(null),
    });
    act(() => void result.current.save("Spring", wall));
    expect(result.current.layouts).toHaveLength(1);
    expect(storage.data.has(syncMarkerKey("bgolski", "layouts", "bgolski"))).toBe(false);
  });

  it("the first time on a browser, combines its layouts with the account's and saves the result", async () => {
    const storage = memoryStorage({
      [layoutsKey("bgolski")]: serializeLayouts([layout("here", "2026-10-01")]),
    });
    const { client, resolveLoad } = fakeClient({
      layouts: { data: serializeLayouts([layout("there", "2026-10-02")]), updatedAt: "t1" },
    });
    const { result } = renderHook(() => useLayouts("Bgolski", { storage }), {
      wrapper: wrapper(client),
    });
    await act(async () => resolveLoad());
    await waitFor(() => expect(result.current.layouts.map((l) => l.id)).toEqual(["here", "there"]));
    expect(client.save).toHaveBeenCalledWith(
      "bgolski",
      "layouts",
      expect.stringContaining('"here"')
    );
    await waitFor(() =>
      expect(marker(storage)).toEqual({ updatedAt: "2026-10-15T10:00:00.000Z", dirty: false })
    );
  });

  it("takes a newer copy from another device in place of this browser's", async () => {
    const storage = memoryStorage({
      [layoutsKey("bgolski")]: serializeLayouts([layout("old", "2026-10-01")]),
      [syncMarkerKey("bgolski", "layouts", "bgolski")]: JSON.stringify({
        updatedAt: "t1",
        dirty: false,
      }),
    });
    const { client, resolveLoad } = fakeClient({
      layouts: { data: serializeLayouts([layout("new", "2026-10-03")]), updatedAt: "t2" },
    });
    const { result } = renderHook(() => useLayouts("bgolski", { storage }), {
      wrapper: wrapper(client),
    });
    await act(async () => resolveLoad());
    await waitFor(() => expect(result.current.layouts.map((l) => l.id)).toEqual(["new"]));
    expect(client.save).not.toHaveBeenCalled();
    expect(storage.data.get(layoutsKey("bgolski"))).toContain('"new"');
  });

  it("keeps a change made before the account answered, and combines it", async () => {
    const storage = memoryStorage({
      [syncMarkerKey("bgolski", "layouts", "bgolski")]: JSON.stringify({
        updatedAt: "t1",
        dirty: false,
      }),
    });
    const { client, resolveLoad } = fakeClient({
      layouts: { data: serializeLayouts([layout("there", "2026-10-02")]), updatedAt: "t2" },
    });
    const { result } = renderHook(() => useLayouts("bgolski", { storage, newId: () => "mine" }), {
      wrapper: wrapper(client),
    });
    act(() => void result.current.save("Mine", wall));
    expect(client.save).not.toHaveBeenCalled();
    expect(marker(storage).dirty).toBe(true);
    await act(async () => resolveLoad());
    await waitFor(() =>
      expect(result.current.layouts.map((l) => l.id).sort()).toEqual(["mine", "there"])
    );
    expect(client.save).toHaveBeenCalledTimes(1);
  });

  it("sends each change once the account's copy is in, and marks a failed one unsent", async () => {
    const storage = memoryStorage();
    const { client, resolveLoad } = fakeClient();
    const { result } = renderHook(() => useLayouts("bgolski", { storage, newId: () => "a" }), {
      wrapper: wrapper(client),
    });
    await act(async () => resolveLoad());
    await waitFor(() => expect(marker(storage)).toEqual({ updatedAt: null, dirty: false }));
    client.save.mockRejectedValueOnce(new Error("offline"));
    await act(async () => void result.current.save("Spring", wall));
    expect(client.save).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(marker(storage).dirty).toBe(true));
  });

  it("keeps wall history in the account the same way", async () => {
    const storage = memoryStorage({
      [hangHistoryKey("bgolski")]: JSON.stringify({
        v: 1,
        hangs: [{ date: "2026-10-01", albumIds: ["1"] }],
      }),
    });
    const { client, resolveLoad } = fakeClient({
      history: {
        data: JSON.stringify({ v: 1, hangs: [{ date: "2026-10-05", albumIds: ["2"] }] }),
        updatedAt: "t1",
      },
    });
    const { result } = renderHook(() => useHangHistory("bgolski", { storage }), {
      wrapper: wrapper(client),
    });
    await act(async () => resolveLoad());
    await waitFor(() =>
      expect(result.current.hangs.map((h) => h.date)).toEqual(["2026-10-01", "2026-10-05"])
    );
    expect(client.save).toHaveBeenCalledWith("bgolski", "history", expect.any(String));
  });
});
