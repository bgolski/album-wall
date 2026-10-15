import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Album } from "@/types";
import { RecordGrid } from "./RecordGrid";

const albums: Album[] = Array.from({ length: 40 }, (_, index) => ({
  id: index + 1,
  title: `Album ${index + 1}`,
  artist: `Artist ${index + 1}`,
}));

const tile = (title: string) =>
  screen.getByAltText(title).closest("[data-album-id]") as HTMLElement;

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("RecordGrid layouts", () => {
  it("opens the layouts from the controls", () => {
    render(<RecordGrid username="someone" albums={albums} onAlbumsReorder={vi.fn()} />);
    expect(screen.queryByLabelText("Name for the current wall")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Layouts" }));
    expect(screen.getByLabelText("Name for the current wall")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Layouts" }).getAttribute("aria-expanded")).toBe(
      "true"
    );
  });

  it("puts a saved wall back with its pins and its order", () => {
    const onAlbumsReorder = vi.fn();
    render(<RecordGrid username="someone" albums={albums} onAlbumsReorder={onAlbumsReorder} />);
    fireEvent.click(screen.getByRole("button", { name: "Pin Album 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Layouts" }));
    fireEvent.change(screen.getByLabelText("Name for the current wall"), {
      target: { value: "Mine" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save current wall" }));

    fireEvent.click(screen.getByRole("button", { name: "Unpin Album 2" }));
    expect(tile("Album 2").getAttribute("data-pinned")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Put Mine on the wall" }));
    expect(tile("Album 2").getAttribute("data-pinned")).toBe("true");
    const order = onAlbumsReorder.mock.calls.at(-1)![0] as Album[];
    expect(order.slice(0, 32).map((album) => album.id)).toEqual(
      Array.from({ length: 32 }, (_, i) => i + 1)
    );
  });
});
