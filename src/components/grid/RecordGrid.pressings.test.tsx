import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Album } from "@/types";
import { RecordGrid } from "./RecordGrid";

const albums: Album[] = [
  { id: 1, title: "Utopia", artist: "Travis Scott", year: "2023" },
  { id: 2, title: "Indicud", artist: "Kid Cudi" },
  { id: 3, title: "Utopia (Clean)", artist: "Travis Scott", year: "2024" },
];

const changes: Album[][] = [];
function Wall() {
  const [order, setOrder] = useState(albums);
  const reorder = (next: Album[]) => {
    changes.push(next);
    setOrder(next);
  };
  return <RecordGrid username="pressings-test" albums={order} onAlbumsReorder={reorder} />;
}

const shownIds = () =>
  [...document.querySelectorAll("[data-album-id]")].map((node) =>
    node.getAttribute("data-album-id")
  );

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("RecordGrid showing each album once", () => {
  const wide = () =>
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    );

  it("hides extra pressings from the start, keeps them in the collection, and can show another", () => {
    wide();
    render(<Wall />);
    expect(shownIds()).toEqual(["1", "2"]);
    fireEvent.click(screen.getByRole("button", { name: "Wall size" }));
    expect(
      (screen.getByRole("switch", { name: "One copy per album" }) as HTMLInputElement).checked
    ).toBe(true);
    expect(screen.getByText("1 extra copy set aside")).toBeTruthy();

    // A shuffle reorders what is shown and keeps the hidden pressing in the collection.
    fireEvent.click(screen.getByRole("button", { name: /Shuffle/ }));
    const latest = changes[changes.length - 1]!;
    expect(latest.map((album) => album.id).sort()).toEqual([1, 2, 3]);
    expect(latest[latest.length - 1]!.id).toBe(3);

    fireEvent.click(screen.getByRole("group", { name: "Utopia by Travis Scott" }));
    fireEvent.click(screen.getByRole("button", { name: "Show this one instead" }));
    expect(shownIds().sort()).toEqual(["2", "3"]);
  });

  it("shows every pressing when turned off, and remembers that for the collection", () => {
    wide();
    const first = render(<Wall />);
    fireEvent.click(screen.getByRole("button", { name: "Wall size" }));
    fireEvent.click(screen.getByRole("switch", { name: "One copy per album" }));
    expect(shownIds()).toEqual(["1", "2", "3"]);
    first.unmount();

    render(<Wall />);
    expect(shownIds()).toEqual(["1", "2", "3"]);
  });

  it("offers the switch only when an album appears more than once", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    );
    render(
      <RecordGrid username="no-pressings" albums={albums.slice(0, 2)} onAlbumsReorder={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Wall size" }));
    expect(screen.queryByRole("switch", { name: "One copy per album" })).toBeNull();
  });
});
