import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNearViewport } from "./useNearViewport";

type Callback = (entries: Pick<IntersectionObserverEntry, "isIntersecting">[]) => void;

describe("useNearViewport", () => {
  let callback: Callback;
  const disconnect = vi.fn();

  beforeEach(() => {
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: Callback) {
          callback = cb;
        }
        observe() {}
        disconnect = disconnect;
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    disconnect.mockClear();
  });

  const element = () => ({ current: document.createElement("div") });

  it("stays false until the element comes near, then stays true", () => {
    const { result } = renderHook(() => useNearViewport(element()));
    expect(result.current).toBe(false);

    act(() => callback([{ isIntersecting: false }]));
    expect(result.current).toBe(false);

    act(() => callback([{ isIntersecting: true }]));
    expect(result.current).toBe(true);
    expect(disconnect).toHaveBeenCalled();
  });

  it("is true at once when always is set, as export needs every cover", () => {
    const { result } = renderHook(() => useNearViewport(element(), true));
    expect(result.current).toBe(true);
  });

  it("is true where IntersectionObserver does not exist", () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("IntersectionObserver", undefined);
    const { result } = renderHook(() => useNearViewport(element()));
    expect(result.current).toBe(true);
  });
});
