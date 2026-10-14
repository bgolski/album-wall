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
  it("hides extra pressings when asked, keeps them in the collection, and can show another", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    );
    render(<Wall />);
    expect(shownIds()).toEqual(["1", "2", "3"]);
    fireEvent.click(screen.getByRole("button", { name: /Configure Grid/ }));

    fireEvent.click(screen.getByRole("switch", { name: /^Show each album once/ }));
    expect(shownIds()).toEqual(["1", "2"]);
    expect(
      screen.getByText(/Setting aside 1 extra pressing: Utopia \(Clean\) \(Travis Scott\)/)
    ).toBeTruthy();

    // A shuffle reorders what is shown and keeps the hidden pressing in the collection.
    fireEvent.click(screen.getByRole("button", { name: /Shuffle/ }));
    const latest = changes[changes.length - 1]!;
    expect(latest.map((album) => album.id).sort()).toEqual([1, 2, 3]);
    expect(latest[latest.length - 1]!.id).toBe(3);

    fireEvent.click(screen.getByRole("group", { name: "Utopia by Travis Scott" }));
    fireEvent.click(screen.getByRole("button", { name: "Show this one instead" }));
    expect(shownIds().sort()).toEqual(["2", "3"]);
  });
});
