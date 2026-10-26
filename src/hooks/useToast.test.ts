import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useToast } from "./useToast";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useToast", () => {
  it("shows a notice and hides it after four seconds", () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toast).toBeNull();
    act(() => result.current.notify("Saved"));
    expect(result.current.toast).toEqual({ message: "Saved", tone: "info" });
    act(() => vi.advanceTimersByTime(3999));
    expect(result.current.toast).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.toast).toBeNull();
  });

  it("keeps a toast with an action up for fifteen seconds", () => {
    const { result } = renderHook(() => useToast());
    const run = vi.fn();
    act(() =>
      result.current.show({ message: "Ready", tone: "info", action: { label: "Share", run } })
    );
    act(() => vi.advanceTimersByTime(14999));
    expect(result.current.toast?.message).toBe("Ready");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.toast).toBeNull();
  });

  it("keeps a busy notice until it is replaced or cleared", () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.show({ message: "Preparing", tone: "info", busy: true }));
    act(() => vi.advanceTimersByTime(60000));
    expect(result.current.toast?.busy).toBe(true);
    act(() => result.current.show((current) => (current?.busy ? null : current)));
    expect(result.current.toast).toBeNull();
  });

  it("starts the time again for each new notice", () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.notify("First"));
    act(() => vi.advanceTimersByTime(3000));
    act(() => result.current.show({ message: "Failed", tone: "error" }));
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.toast).toEqual({ message: "Failed", tone: "error" });
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.toast).toBeNull();
  });

  it("gives the same notify and show on every render", () => {
    const { result, rerender } = renderHook(() => useToast());
    const { notify, show } = result.current;
    act(() => notify("Saved"));
    rerender();
    expect(result.current.notify).toBe(notify);
    expect(result.current.show).toBe(show);
  });
});
