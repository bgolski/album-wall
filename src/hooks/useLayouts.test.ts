import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SharedWallState } from "@/types";
import { layoutsKey } from "@/utils/layoutStore";
import { useLayouts } from "./useLayouts";

function fakeStorage(initial: Record<string, string> = {}) {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

const wall = (ids: string[]): SharedWallState => ({
  v: 1,
  username: "someone",
  rows: 1,
  columns: ids.length,
  wallAlbumIds: ids,
  pinnedAlbumIds: [],
});

function setup(storage: ReturnType<typeof fakeStorage> | null = fakeStorage()) {
  let tick = 0;
  let id = 0;
  const options = {
    storage,
    now: () => new Date(Date.UTC(2026, 9, 13, 12, 0, tick++)),
    newId: () => `id-${++id}`,
  };
  return { storage, ...renderHook(() => useLayouts("Someone", options)) };
}

describe("useLayouts", () => {
  it("saves a layout, keeps it in storage and lists it", () => {
    const { result, storage } = setup();
    let problem: string | null = "unset";
    act(() => {
      problem = result.current.save("Autumn", wall(["1", "2"]));
    });
    expect(problem).toBeNull();
    expect(result.current.layouts.map((layout) => layout.name)).toEqual(["Autumn"]);
    expect(JSON.parse(storage!.data[layoutsKey("someone")]!).layouts).toHaveLength(1);
  });

  it("reads the layouts already saved for the collection", () => {
    const first = setup();
    act(() => void first.result.current.save("Autumn", wall(["1"])));
    const again = renderHook(() => useLayouts("someone", { storage: first.storage }));
    expect(again.result.current.layouts.map((layout) => layout.name)).toEqual(["Autumn"]);
  });

  it("explains a blank name, and renames and deletes", () => {
    const { result } = setup();
    let problem: string | null = null;
    act(() => {
      problem = result.current.save("  ", wall(["1"]));
    });
    expect(problem).toBe("Give the layout a name.");
    act(() => void result.current.save("Autumn", wall(["1"])));
    const id = result.current.layouts[0]!.id;
    act(() => void result.current.rename(id, "Spring"));
    expect(result.current.layouts[0]!.name).toBe("Spring");
    act(() => void result.current.remove(id));
    expect(result.current.layouts).toEqual([]);
  });

  it("says when nothing can be saved", () => {
    const { result } = setup(null);
    let problem: string | null = null;
    act(() => {
      problem = result.current.save("Autumn", wall(["1"]));
    });
    expect(problem).toMatch(/not letting the page save/);
    expect(result.current.layouts).toEqual([]);
  });

  it("says when storage is full and keeps the list as it was", () => {
    const storage = fakeStorage();
    const { result } = setup(storage);
    storage.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
    let problem: string | null = null;
    act(() => {
      problem = result.current.save("Autumn", wall(["1"]));
    });
    expect(problem).toMatch(/storage is full/);
    expect(result.current.layouts).toEqual([]);
  });

  it("asks for a backup until the layouts are exported, and again after a new save", () => {
    const { result } = setup();
    expect(result.current.needsBackup).toBe(false);
    act(() => void result.current.save("Autumn", wall(["1"])));
    expect(result.current.needsBackup).toBe(true);
    let text = "";
    act(() => {
      text = result.current.exportText();
    });
    expect(JSON.parse(text).layouts).toHaveLength(1);
    expect(result.current.needsBackup).toBe(false);
    act(() => void result.current.save("Winter", wall(["2"])));
    expect(result.current.needsBackup).toBe(true);
  });

  it("imports a backup without replacing what is here, and reports what happened", () => {
    const source = setup();
    act(() => void source.result.current.save("Autumn", wall(["1"])));
    let backup = "";
    act(() => {
      backup = source.result.current.exportText();
    });

    const target = setup(fakeStorage());
    let outcome = { ok: false, message: "" };
    act(() => {
      outcome = target.result.current.importText(backup);
    });
    expect(outcome).toEqual({ ok: true, message: "Added 1 layout." });
    act(() => {
      outcome = target.result.current.importText(backup);
    });
    expect(outcome.message).toBe("Added 0 layouts, skipped 1 already here or damaged.");
    act(() => {
      outcome = target.result.current.importText("not a backup");
    });
    expect(outcome).toEqual({ ok: false, message: "That file is not an Album Wall layouts file." });
  });
});
