import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useUndoHistory } from "./useUndoHistory";

describe("useUndoHistory", () => {
  it("starts empty", () => {
    const { result } = renderHook(() => useUndoHistory<number>());
    expect(result.current.canUndo).toBe(false);
    let value: number | undefined = 1;
    act(() => {
      value = result.current.undo();
    });
    expect(value).toBeUndefined();
  });

  it("returns snapshots newest first", () => {
    const { result } = renderHook(() => useUndoHistory<string>());
    act(() => {
      result.current.record("a");
      result.current.record("b");
    });
    expect(result.current.canUndo).toBe(true);
    const undone: (string | undefined)[] = [];
    act(() => {
      undone.push(result.current.undo());
    });
    act(() => {
      undone.push(result.current.undo());
    });
    expect(undone).toEqual(["b", "a"]);
    expect(result.current.canUndo).toBe(false);
  });

  it("keeps only the most recent snapshots up to the limit", () => {
    const { result } = renderHook(() => useUndoHistory<number>(3));
    act(() => {
      for (const n of [1, 2, 3, 4, 5]) result.current.record(n);
    });
    const undone: (number | undefined)[] = [];
    act(() => {
      for (let i = 0; i < 4; i++) undone.push(result.current.undo());
    });
    expect(undone).toEqual([5, 4, 3, undefined]);
  });

  it("defaults to twenty snapshots", () => {
    const { result } = renderHook(() => useUndoHistory<number>());
    act(() => {
      for (let n = 1; n <= 25; n++) result.current.record(n);
    });
    const undone: (number | undefined)[] = [];
    act(() => {
      for (let i = 0; i < 21; i++) undone.push(result.current.undo());
    });
    expect(undone.slice(0, 2)).toEqual([25, 24]);
    expect(undone[19]).toBe(6);
    expect(undone[20]).toBeUndefined();
  });

  it("clear empties the history", () => {
    const { result } = renderHook(() => useUndoHistory<number>());
    act(() => {
      result.current.record(1);
      result.current.clear();
    });
    expect(result.current.canUndo).toBe(false);
    let value: number | undefined = 0;
    act(() => {
      value = result.current.undo();
    });
    expect(value).toBeUndefined();
  });

  it("keeps the same functions between renders", () => {
    const { result, rerender } = renderHook(() => useUndoHistory<number>());
    const { record, undo, clear } = result.current;
    act(() => {
      record(1);
    });
    rerender();
    expect(result.current.record).toBe(record);
    expect(result.current.undo).toBe(undo);
    expect(result.current.clear).toBe(clear);
  });
});
