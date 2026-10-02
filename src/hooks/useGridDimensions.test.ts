import { describe, it, expect, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGridDimensions } from "./useGridDimensions";

// Helper to temporarily override window.innerWidth
function setWindowWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
}

describe("useGridDimensions", () => {
  afterEach(() => {
    // restore to a safe default after each test
    setWindowWidth(1024);
  });

  it("returns default dimensions based on viewport width", () => {
    // Mobile width
    setWindowWidth(500);
    const { result } = renderHook(() => useGridDimensions());
    expect(result.current.rows).toBe(4);
    expect(result.current.columns).toBe(4); // MOBILE_DEFAULT_COLUMNS

    // Desktop width
    setWindowWidth(1024);
    const { result: desktopResult } = renderHook(() => useGridDimensions());
    expect(desktopResult.current.rows).toBe(4);
    expect(desktopResult.current.columns).toBe(8); // DEFAULT_COLUMNS
  });

  it("uses provided initial dimensions over defaults", () => {
    setWindowWidth(500); // mobile, but should be overridden
    const { result } = renderHook(() => useGridDimensions({ rows: 2, columns: 3 }));
    expect(result.current.rows).toBe(2);
    expect(result.current.columns).toBe(3);
  });

  it("handleDimensionsChange updates only with valid positive values", () => {
    const { result } = renderHook(() => useGridDimensions());
    act(() => result.current.handleDimensionsChange(6, 10));
    expect(result.current.rows).toBe(6);
    expect(result.current.columns).toBe(10);

    // Invalid values should leave state unchanged
    act(() => result.current.handleDimensionsChange(0, 5));
    expect(result.current.rows).toBe(6);
    expect(result.current.columns).toBe(10);
    act(() => result.current.handleDimensionsChange(5, -1));
    expect(result.current.rows).toBe(6);
    expect(result.current.columns).toBe(10);
  });

  it("replaceDimensions behaves like handleDimensionsChange but memoized", () => {
    const { result } = renderHook(() => useGridDimensions());
    act(() => result.current.replaceDimensions(3, 7));
    expect(result.current.rows).toBe(3);
    expect(result.current.columns).toBe(7);
  });

  it("resetToDefault restores viewport-specific defaults", () => {
    setWindowWidth(500); // mobile default columns = 4
    const { result } = renderHook(() => useGridDimensions());
    act(() => result.current.handleDimensionsChange(2, 2));
    expect(result.current.rows).toBe(2);
    expect(result.current.columns).toBe(2);

    act(() => result.current.resetToDefault());
    expect(result.current.rows).toBe(4);
    expect(result.current.columns).toBe(4);
  });

  it("toggleConfig toggles visibility flag", () => {
    const { result } = renderHook(() => useGridDimensions());
    expect(result.current.showDimensionsConfig).toBe(false);
    act(() => result.current.toggleConfig());
    expect(result.current.showDimensionsConfig).toBe(true);
    act(() => result.current.toggleConfig());
    expect(result.current.showDimensionsConfig).toBe(false);
  });

  it("gridSize reflects current rows * columns", () => {
    const { result } = renderHook(() => useGridDimensions());
    expect(result.current.gridSize).toBe(result.current.rows * result.current.columns);
    act(() => result.current.handleDimensionsChange(5, 6));
    expect(result.current.gridSize).toBe(30);
  });
});
