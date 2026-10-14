import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useHangHistory } from "./useHangHistory";

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

describe("useHangHistory", () => {
  it("remembers walls marked as hung, per collection, and when each album was last up", () => {
    const storage = memoryStorage();
    const now = () => new Date(2026, 9, 14, 20);
    const { result, rerender } = renderHook(({ name }) => useHangHistory(name, { storage, now }), {
      initialProps: { name: "someone" },
    });
    act(() => void result.current.markHung(["1", "2"]));
    expect(result.current.lastHung.get("2")).toBe("2026-10-14");

    rerender({ name: "someone else" });
    expect(result.current.hangs).toEqual([]);
    rerender({ name: "someone" });
    expect(result.current.hangs).toHaveLength(1);

    act(() => void result.current.clear());
    expect(result.current.hangs).toEqual([]);
  });

  it("says when it cannot keep anything", () => {
    const { result } = renderHook(() => useHangHistory("someone", { storage: null }));
    let problem: string | null = null;
    act(() => {
      problem = result.current.markHung(["1"]);
    });
    expect(problem).toMatch(/not letting the page save/);
  });
});
