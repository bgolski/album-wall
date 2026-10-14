import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook } from "@testing-library/react";
import type { Album } from "@/types";
import { useUndoShortcut } from "./useUndoShortcut";
import { useMoveMode } from "./useMoveMode";
import { useWallResize } from "./useWallResize";

afterEach(cleanup);

const album = (id: number): Album => ({ id, title: `T${id}`, artist: `A${id}` });

describe("useUndoShortcut", () => {
  it("undoes on Ctrl+Z or Cmd+Z, but not while typing or with other modifiers", () => {
    const undo = vi.fn();
    renderHook(() => useUndoShortcut(undo));
    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
    fireEvent.keyDown(document.body, { key: "Z", metaKey: true });
    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(document.body, { key: "z" });
    const { container } = render(<input aria-label="field" />);
    fireEvent.keyDown(container.querySelector("input")!, { key: "z", ctrlKey: true });
    expect(undo).toHaveBeenCalledTimes(2);
  });
});

describe("useMoveMode", () => {
  const wall = [album(1), album(2)];
  const pool = [album(3)];

  it("opens an album's details on a tap, and swaps on the next tap after Move", () => {
    const onAlbumsReorder = vi.fn();
    const { result } = renderHook(() =>
      useMoveMode({
        displayedAlbums: wall,
        poolItems: pool,
        pinnedAlbums: new Set(),
        onAlbumsReorder,
      })
    );
    act(() => result.current.selectAlbum(wall[0]!));
    expect(result.current.sheetAlbum?.id).toBe(1);
    act(() => result.current.startMove(wall[0]!));
    expect(result.current.sheetAlbum).toBeNull();
    act(() => result.current.selectAlbum(pool[0]!));
    expect(onAlbumsReorder.mock.calls[0]![0].map((a: Album) => a.id)).toEqual([3, 2, 1]);
    expect(result.current.movingAlbum).toBeNull();
  });

  it("refuses to swap with a pinned album and says so", () => {
    const onAlbumsReorder = vi.fn();
    const { result } = renderHook(() =>
      useMoveMode({
        displayedAlbums: wall,
        poolItems: pool,
        pinnedAlbums: new Set(["2"]),
        onAlbumsReorder,
      })
    );
    act(() => result.current.startMove(wall[0]!));
    act(() => result.current.selectAlbum(wall[1]!));
    expect(onAlbumsReorder).not.toHaveBeenCalled();
    expect(result.current.moveMessage).toBe("Pinned albums can't be swapped. Tap another album.");
  });
});

describe("useWallResize", () => {
  it("unpins albums a smaller wall pushes into the pool, and ignores sizes below one", () => {
    const removePinsForAlbums = vi.fn();
    const setSize = vi.fn();
    const { result } = renderHook(() =>
      useWallResize({
        displayedAlbums: [album(1), album(2), album(3), album(4)],
        removePinsForAlbums,
        setSize,
        resetSize: vi.fn(),
        defaultSize: 4,
      })
    );
    act(() => result.current.changeSize(1, 2));
    expect(removePinsForAlbums).toHaveBeenCalledWith(["3", "4"]);
    expect(setSize).toHaveBeenCalledWith(1, 2);
    act(() => result.current.changeSize(0, 2));
    expect(setSize).toHaveBeenCalledTimes(1);
  });
});
