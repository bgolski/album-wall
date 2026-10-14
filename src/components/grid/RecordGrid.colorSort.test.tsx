import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Album } from "@/types";
import type { CoverColor } from "@/utils/colorBasics";
import { RecordGrid } from "./RecordGrid";

// The measuring itself is tested with the hook; here the grid is given colors directly.
const measuring = vi.hoisted(() => ({
  colors: {} as Record<string, CoverColor | null>,
  pending: 0,
  enabledCalls: [] as boolean[],
}));
vi.mock("@/hooks/useCoverColors", () => ({
  useCoverColors: (_albums: Album[], enabled: boolean) => {
    measuring.enabledCalls.push(enabled);
    return {
      colors: enabled ? measuring.colors : {},
      pending: enabled ? measuring.pending : 0,
    };
  },
}));

const albums: Album[] = Array.from({ length: 40 }, (_, index) => ({
  id: index + 1,
  title: `Album ${index + 1}`,
  artist: `Artist ${index + 1}`,
}));

const colorAt = (hue: number): CoverColor => ({
  l: 0.6,
  a: 0.15 * Math.cos((hue * Math.PI) / 180),
  b: 0.15 * Math.sin((hue * Math.PI) / 180),
});

// Odd albums are orange, even albums are blue, so a color sort puts every odd album first.
function setColors(unreadable: number[] = []) {
  measuring.colors = Object.fromEntries(
    albums.map((album) => [
      String(album.id),
      unreadable.includes(album.id) ? null : colorAt(album.id % 2 === 1 ? 30 : 200),
    ])
  );
}

function renderGrid() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
  const onAlbumsReorder = vi.fn();
  render(<RecordGrid username="someone" albums={albums} onAlbumsReorder={onAlbumsReorder} />);
  return onAlbumsReorder;
}

const wallOrder = () =>
  [...document.querySelectorAll("[data-album-id]")]
    .slice(0, 32)
    .map((node) => Number(node.getAttribute("data-album-id")));

const sortByColor = () => fireEvent.click(screen.getByRole("button", { name: "Sort by Color" }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  measuring.pending = 0;
  measuring.enabledCalls = [];
  setColors();
});

describe("RecordGrid sort by color", () => {
  it("measures nothing until Sort by Color is chosen", () => {
    setColors();
    renderGrid();
    expect(measuring.enabledCalls.every((enabled) => !enabled)).toBe(true);
    sortByColor();
    expect(measuring.enabledCalls.at(-1)).toBe(true);
  });

  it("puts the wall in color order once the colors are known", () => {
    setColors();
    const onAlbumsReorder = renderGrid();
    sortByColor();
    const order = wallOrder();
    expect(order.slice(0, 16)).toEqual(Array.from({ length: 16 }, (_, i) => 2 * i + 1));
    expect(order.slice(16)).toEqual(Array.from({ length: 16 }, (_, i) => 2 * i + 2));
    expect(screen.getByRole("button", { name: "Sort by Color" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(onAlbumsReorder).not.toHaveBeenCalled();
  });

  it("keeps the wall as it is, and says so, while colors are still being read", () => {
    setColors();
    measuring.pending = 5;
    renderGrid();
    sortByColor();
    expect(wallOrder()).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
    expect(screen.getByText("Reading cover colors... 5 left")).toBeTruthy();
  });

  it("keeps a pinned album where it is", () => {
    setColors();
    renderGrid();
    fireEvent.click(screen.getByRole("button", { name: "Pin Album 4" }));
    sortByColor();
    expect(wallOrder()[3]).toBe(4);
  });

  it("says how many covers had no readable color and places them last", () => {
    setColors([1, 2]);
    renderGrid();
    sortByColor();
    expect(screen.getByText("2 covers had no readable color and were placed last.")).toBeTruthy();
    expect(wallOrder().slice(-2)).toEqual([1, 2]);
  });

  it("says nothing extra when every color was read", () => {
    setColors();
    renderGrid();
    sortByColor();
    expect(screen.queryByText(/Reading cover colors|had no readable color/)).toBeNull();
  });

  it("returns to the custom order and stops measuring", () => {
    setColors();
    renderGrid();
    sortByColor();
    fireEvent.click(screen.getByRole("button", { name: "Custom Order" }));
    expect(wallOrder()).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
    expect(measuring.enabledCalls.at(-1)).toBe(false);
  });
});
