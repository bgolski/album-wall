import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useWelcome } from "./useWelcome";

beforeEach(() => {
  window.localStorage.clear();
  window.location.hash = "";
});
afterEach(() => {
  cleanup();
  window.location.hash = "";
});

describe("useWelcome", () => {
  it("greets a first-time visitor once the demo is available and no wall is showing", () => {
    const { result } = renderHook(() => useWelcome(true, false));
    expect(result.current.open).toBe(true);
  });

  it("stays closed until the demo exists and while a wall is showing", () => {
    expect(renderHook(() => useWelcome(false, false)).result.current.open).toBe(false);
    expect(renderHook(() => useWelcome(true, true)).result.current.open).toBe(false);
  });

  it("does not greet someone who has loaded a collection here before", () => {
    window.localStorage.setItem("album-wall:last-username", "vinylfan");
    expect(renderHook(() => useWelcome(true, false)).result.current.open).toBe(false);
  });

  it("does not greet someone who opened a share link", () => {
    window.location.hash = "#share=abc";
    expect(renderHook(() => useWelcome(true, false)).result.current.open).toBe(false);
  });

  it("remembers a dismissal for later visits", () => {
    const { result } = renderHook(() => useWelcome(true, false));
    act(() => result.current.dismiss());
    expect(result.current.open).toBe(false);
    cleanup();
    expect(renderHook(() => useWelcome(true, false)).result.current.open).toBe(false);
  });
});
