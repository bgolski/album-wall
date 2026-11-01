import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Album } from "@/types";
import type { CoverColor } from "@/color/colorBasics";
import type { CoverProfile } from "@/color/coverProfile";
import { PROFILE_CACHE_KEY, saveProfileCache } from "@/color/colorCache";
import { useCoverColors } from "./useCoverColors";

const red: CoverColor = { l: 0.63, a: 0.22, b: 0.13 };
const blue: CoverColor = { l: 0.45, a: -0.03, b: -0.31 };

const profileOf = (color: CoverColor): CoverProfile => ({
  color,
  palette: [{ color, share: 1 }],
  regions: Array.from({ length: 9 }, () => color),
});

const album = (id: number, cover?: string, color?: CoverColor): Album => ({
  id,
  title: `Album ${id}`,
  artist: "Artist",
  ...(cover ? { cover_image: cover } : {}),
  ...(color ? { color, profile: profileOf(color) } : {}),
});

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

const colorsByUrl: Record<string, CoverColor | null> = {
  "https://x/red.jpg": red,
  "https://x/blue.jpg": blue,
  "https://x/broken.jpg": null,
};
const reader = () =>
  vi.fn(async (url: string) => {
    const color = colorsByUrl[url];
    return color ? profileOf(color) : null;
  });

describe("useCoverColors", () => {
  it("measures nothing and touches no storage until enabled", async () => {
    const read = reader();
    const storage = fakeStorage();
    const getItem = vi.spyOn(storage, "getItem");
    const { result } = renderHook(() =>
      useCoverColors([album(1, "https://x/red.jpg")], false, { read, storage })
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(read).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    expect(result.current).toEqual({ colors: {}, profiles: {}, pending: 0, total: 1 });
  });

  it("measures each distinct cover once and keys the colors by album id", async () => {
    const read = reader();
    const albums = [
      album(1, "https://x/red.jpg"),
      album(2, "https://x/blue.jpg"),
      album(3, "https://x/red.jpg"),
    ];
    const { result } = renderHook(() => useCoverColors(albums, true, { read, storage: null }));
    await waitFor(() => expect(result.current.pending).toBe(0));
    expect(read).toHaveBeenCalledTimes(2);
    expect(result.current.colors).toEqual({ "1": red, "2": blue, "3": red });
  });

  it("uses a color shipped with the album without a request", async () => {
    const read = reader();
    const albums = [album(1, "https://x/other.jpg", blue)];
    const { result } = renderHook(() => useCoverColors(albums, true, { read, storage: null }));
    await waitFor(() => expect(result.current.colors).toEqual({ "1": blue }));
    expect(read).not.toHaveBeenCalled();
  });

  it("uses colors remembered from an earlier visit, and remembers new ones", async () => {
    const read = reader();
    const storage = fakeStorage();
    saveProfileCache(storage, new Map([["https://x/red.jpg", profileOf(red)]]));
    const albums = [album(1, "https://x/red.jpg"), album(2, "https://x/blue.jpg")];
    const { result } = renderHook(() => useCoverColors(albums, true, { read, storage }));
    await waitFor(() => expect(result.current.pending).toBe(0));
    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith("https://x/blue.jpg");
    const saved = JSON.parse(storage.data[PROFILE_CACHE_KEY]!);
    expect(Object.keys(saved.covers).sort()).toEqual(["https://x/blue.jpg", "https://x/red.jpg"]);
    expect(result.current.profiles["2"]).toEqual(profileOf(blue));
  });

  it("reports a cover that cannot be read as null and does not remember it", async () => {
    const read = reader();
    const storage = fakeStorage();
    const albums = [album(1, "https://x/broken.jpg"), album(2, "https://x/red.jpg")];
    const { result } = renderHook(() => useCoverColors(albums, true, { read, storage }));
    await waitFor(() => expect(result.current.pending).toBe(0));
    expect(result.current.colors).toEqual({ "1": null, "2": red });
    expect(Object.keys(JSON.parse(storage.data[PROFILE_CACHE_KEY]!).covers)).toEqual([
      "https://x/red.jpg",
    ]);
  });

  it("treats a failing reader as an unreadable cover", async () => {
    const read = vi.fn(async () => {
      throw new Error("network");
    });
    const { result } = renderHook(() =>
      useCoverColors([album(1, "https://x/red.jpg")], true, { read, storage: null })
    );
    await waitFor(() => expect(result.current.pending).toBe(0));
    expect(result.current.colors).toEqual({ "1": null });
  });

  it("never measures more covers at once than allowed", async () => {
    let active = 0;
    let most = 0;
    const read = vi.fn(async () => {
      active += 1;
      most = Math.max(most, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return profileOf(red);
    });
    const albums = Array.from({ length: 12 }, (_, i) => album(i + 1, `https://x/c${i}.jpg`));
    const { result } = renderHook(() =>
      useCoverColors(albums, true, { read, storage: null, concurrency: 3 })
    );
    await waitFor(() => expect(result.current.pending).toBe(0));
    expect(read).toHaveBeenCalledTimes(12);
    expect(most).toBeLessThanOrEqual(3);
  });

  it("reports progress as covers are measured", async () => {
    const waiting: ((profile: CoverProfile | null) => void)[] = [];
    const read = vi.fn(() => new Promise<CoverProfile | null>((resolve) => waiting.push(resolve)));
    const albums = [
      album(1, "https://x/a.jpg"),
      album(2, "https://x/b.jpg"),
      album(3, "https://x/a.jpg"),
      album(4, "https://x/c.jpg", blue),
      album(5),
    ];
    const { result } = renderHook(() =>
      useCoverColors(albums, true, { read, storage: null, concurrency: 1 })
    );
    expect(result.current.total).toBe(3);
    expect(result.current.pending).toBe(2);
    await waitFor(() => expect(waiting).toHaveLength(1));
    act(() => waiting.shift()!(profileOf(red)));
    await waitFor(() => expect(result.current.pending).toBe(1));
    await waitFor(() => expect(waiting).toHaveLength(1));
    act(() => waiting.shift()!(null));
    await waitFor(() => expect(result.current.pending).toBe(0));
    expect(result.current.total).toBe(3);
    expect(result.current.colors).toEqual({ "1": red, "2": null, "3": red, "4": blue });
  });

  it("stops measuring when it is turned off", async () => {
    const waiting: ((profile: CoverProfile | null) => void)[] = [];
    const read = vi.fn(() => new Promise<CoverProfile | null>((resolve) => waiting.push(resolve)));
    const albums = Array.from({ length: 6 }, (_, i) => album(i + 1, `https://x/s${i}.jpg`));
    const { rerender } = renderHook(
      ({ enabled }) => useCoverColors(albums, enabled, { read, storage: null, concurrency: 2 }),
      { initialProps: { enabled: true } }
    );
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    rerender({ enabled: false });
    act(() => waiting.splice(0).forEach((resolve) => resolve(profileOf(red))));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("does not measure again when the albums are only reordered", async () => {
    const read = reader();
    const first = [album(1, "https://x/red.jpg"), album(2, "https://x/blue.jpg")];
    const { result, rerender } = renderHook(
      ({ albums }) => useCoverColors(albums, true, { read, storage: null }),
      { initialProps: { albums: first } }
    );
    await waitFor(() => expect(result.current.pending).toBe(0));
    act(() => rerender({ albums: [first[1]!, first[0]!] }));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(read).toHaveBeenCalledTimes(2);
    expect(result.current.colors).toEqual({ "1": red, "2": blue });
  });

  describe("with a shared profile service", () => {
    it("takes the profiles the service has and measures only the rest", async () => {
      const read = reader();
      const shared = vi.fn(async () => new Map([["https://x/red.jpg", profileOf(red)]]));
      const albums = [album(1, "https://x/red.jpg"), album(2, "https://x/blue.jpg")];
      const { result } = renderHook(() =>
        useCoverColors(albums, true, { read, storage: null, shared })
      );
      await waitFor(() => expect(result.current.pending).toBe(0));
      expect(shared).toHaveBeenCalledWith(
        ["https://x/blue.jpg", "https://x/red.jpg"],
        expect.any(AbortSignal)
      );
      expect(read.mock.calls.map((call) => call[0])).toEqual(["https://x/blue.jpg"]);
      expect(result.current.colors).toEqual({ "1": red, "2": blue });
    });

    it("measures nothing when the service has every cover, and remembers them", async () => {
      const read = reader();
      const storage = fakeStorage();
      const shared = async () =>
        new Map([
          ["https://x/red.jpg", profileOf(red)],
          ["https://x/blue.jpg", profileOf(blue)],
        ]);
      const albums = [album(1, "https://x/red.jpg"), album(2, "https://x/blue.jpg")];
      const { result } = renderHook(() => useCoverColors(albums, true, { read, storage, shared }));
      await waitFor(() => expect(result.current.pending).toBe(0));
      expect(read).not.toHaveBeenCalled();
      expect(storage.data[PROFILE_CACHE_KEY]).toContain("https://x/blue.jpg");
    });

    it("asks once for a set of covers even when the asking function is new on every render", async () => {
      const read = reader();
      const asked: string[][] = [];
      const albums = [album(1, "https://x/red.jpg"), album(2, "https://x/blue.jpg")];
      const { result, rerender } = renderHook(() =>
        useCoverColors(albums, true, {
          read,
          storage: null,
          shared: async (urls) => {
            asked.push(urls);
            await new Promise((resolve) => setTimeout(resolve, 20));
            return new Map<string, CoverProfile>();
          },
        })
      );
      rerender();
      rerender();
      await waitFor(() => expect(result.current.pending).toBe(0));
      expect(asked).toHaveLength(1);
    });

    it("measures everything here when the service fails", async () => {
      const read = reader();
      const shared = vi.fn(() => Promise.reject(new Error("down")));
      const albums = [album(1, "https://x/red.jpg"), album(2, "https://x/blue.jpg")];
      const { result } = renderHook(() =>
        useCoverColors(albums, true, { read, storage: null, shared })
      );
      await waitFor(() => expect(result.current.pending).toBe(0));
      expect(read).toHaveBeenCalledTimes(2);
    });

    it("does not ask for covers already remembered or shipped with the album", async () => {
      const read = reader();
      const shared = vi.fn<(urls: string[]) => Promise<Map<string, CoverProfile>>>(
        async () => new Map()
      );
      const storage = fakeStorage();
      saveProfileCache(storage, new Map([["https://x/blue.jpg", profileOf(blue)]]));
      const albums = [
        album(1, "https://x/red.jpg"),
        album(2, "https://x/blue.jpg"),
        album(3, "https://x/shipped.jpg", red),
      ];
      const { result } = renderHook(() => useCoverColors(albums, true, { read, storage, shared }));
      await waitFor(() => expect(result.current.pending).toBe(0));
      expect(shared.mock.calls[0]![0]).toEqual(["https://x/red.jpg"]);
    });
  });
});
