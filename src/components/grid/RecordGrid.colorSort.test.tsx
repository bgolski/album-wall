import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Album } from "@/types";
import type { CoverColor } from "@/utils/colorBasics";
import type { CoverProfile } from "@/utils/coverProfile";
import { RecordGrid } from "./RecordGrid";

// The measuring itself is tested with the hook; here the grid is given profiles directly.
const measuring = vi.hoisted(() => ({
  profiles: {} as Record<string, CoverProfile | null>,
  pending: 0,
  calls: [] as { count: number; enabled: boolean }[],
}));
vi.mock("@/hooks/useCoverColors", () => ({
  useCoverColors: (albums: Album[], enabled: boolean) => {
    measuring.calls.push({ count: albums.length, enabled });
    return {
      colors: {},
      profiles: enabled ? measuring.profiles : {},
      pending: enabled ? measuring.pending : 0,
      total: albums.length,
    };
  },
}));

const albums: Album[] = Array.from({ length: 40 }, (_, index) => ({
  id: index + 1,
  title: `Album ${index + 1}`,
  artist: `Artist ${index + 1}`,
}));

const colorAt = (hue: number): CoverColor => ({
  l: 0.7,
  a: 0.15 * Math.cos((hue * Math.PI) / 180),
  b: 0.15 * Math.sin((hue * Math.PI) / 180),
});

// Odd albums are orange all over, even albums are blue.
function setProfiles() {
  measuring.profiles = Object.fromEntries(
    albums.map((album) => {
      const color = colorAt(album.id % 2 === 1 ? 55 : 250);
      return [
        String(album.id),
        { color, palette: [{ color, share: 1 }], regions: Array.from({ length: 9 }, () => color) },
      ];
    })
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

const sortByColor = () => fireEvent.click(screen.getByRole("button", { name: "Color" }));
const buildAllOrange = async () => {
  fireEvent.click(screen.getByRole("button", { name: "All orange" }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Build wall" }));
  });
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  measuring.pending = 0;
  measuring.calls = [];
  setProfiles();
});

describe("RecordGrid sort by color", () => {
  it("measures nothing until Sort by Color is chosen, then the whole collection", () => {
    setProfiles();
    renderGrid();
    expect(measuring.calls.every((call) => !call.enabled)).toBe(true);
    sortByColor();
    expect(measuring.calls.at(-1)).toEqual({ count: 40, enabled: true });
  });

  it("opens the gradient builder and leaves the wall alone until a wall is built", () => {
    setProfiles();
    const onAlbumsReorder = renderGrid();
    sortByColor();
    expect(screen.getByRole("heading", { name: "Sort by Color" })).toBeTruthy();
    expect(wallOrder()).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
    expect(onAlbumsReorder).not.toHaveBeenCalled();
  });

  it("builds the wall from the whole collection as one reorder", async () => {
    setProfiles();
    const onAlbumsReorder = renderGrid();
    sortByColor();
    await buildAllOrange();

    expect(onAlbumsReorder).toHaveBeenCalledTimes(1);
    const reordered = (onAlbumsReorder.mock.calls[0]![0] as Album[]).map((album) => album.id);
    expect([...reordered].sort((x, y) => x - y)).toEqual(albums.map((album) => album.id));
    // All twenty orange covers make it onto the 32-cover wall.
    const wall = new Set(reordered.slice(0, 32));
    expect(albums.filter((album) => album.id % 2 === 1).every((album) => wall.has(album.id))).toBe(
      true
    );
    expect(screen.getByText(/^Wall built/)).toBeTruthy();
  });

  it("keeps a pinned album where it is", async () => {
    setProfiles();
    const onAlbumsReorder = renderGrid();
    fireEvent.click(screen.getByRole("button", { name: "Pin Album 4" }));
    sortByColor();
    await buildAllOrange();
    expect((onAlbumsReorder.mock.calls[0]![0] as Album[])[3]!.id).toBe(4);
  });

  it("waits for the cover colors before building", () => {
    setProfiles();
    measuring.pending = 5;
    renderGrid();
    sortByColor();
    expect((screen.getByRole("button", { name: "Build wall" }) as HTMLButtonElement).disabled).toBe(
      true
    );
    expect(screen.getByText("Reading cover colors... 35 of 40")).toBeTruthy();
  });

  it("closes the builder and stops measuring on Custom Order", () => {
    setProfiles();
    renderGrid();
    sortByColor();
    fireEvent.click(screen.getByRole("button", { name: "By hand" }));
    expect(screen.queryByRole("button", { name: "Build wall" })).toBeNull();
    expect(measuring.calls.at(-1)!.enabled).toBe(false);
  });
});

describe("RecordGrid sort by color and undo", () => {
  it("keeps the gradient builder open after Undo so the wall can be built again", async () => {
    setProfiles();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    );
    render(
      <RecordGrid
        username="someone"
        albums={albums}
        onAlbumsReorder={vi.fn()}
        canUndo
        onUndo={() => true}
      />
    );
    sortByColor();
    await buildAllOrange();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByRole("button", { name: "Build wall" })).toBeTruthy();
  });
});

describe("RecordGrid starting a wall from a cover's color", () => {
  it("fills the builder with a color from the cover's details", () => {
    setProfiles();
    renderGrid();
    sortByColor();
    fireEvent.click(screen.getByRole("group", { name: "Album 1 by Artist 1" }));
    fireEvent.click(screen.getByRole("button", { name: /^Start a wall from this/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText(/^Starting from a color on Album 1/)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Color \d/ })).toHaveLength(2);
  });
});
