import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Album } from "@/types";
import { RecordGrid } from "./RecordGrid";

// The parent owns the order, as the app does.
function Wall({ initial }: { initial: Album[] }) {
  const [albums, setAlbums] = useState(initial);
  return <RecordGrid username="someone" albums={albums} onAlbumsReorder={setAlbums} />;
}

const albums: Album[] = ["Delta", "Alpha", "Charlie", "Bravo"].map((artist, index) => ({
  id: index + 1,
  title: `Album ${index + 1}`,
  artist,
}));

const wallArtists = () =>
  [...document.querySelectorAll("[data-album-id]")]
    .slice(0, 4)
    .map(
      (node) =>
        albums.find((album) => String(album.id) === node.getAttribute("data-album-id"))!.artist
    );

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RecordGrid after a sort", () => {
  it("keeps a move made by hand instead of sorting it away, and returns to Custom Order", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    );
    render(<Wall initial={albums} />);
    fireEvent.click(screen.getByRole("button", { name: "Sort by Artist" }));
    expect(wallArtists()).toEqual(["Alpha", "Bravo", "Charlie", "Delta"]);

    // Move Alpha onto Delta's spot with the album sheet's Move.
    fireEvent.click(screen.getByRole("group", { name: "Album 2 by Alpha" }));
    fireEvent.click(screen.getByRole("button", { name: /^Move/ }));
    fireEvent.click(screen.getByRole("group", { name: "Album 1 by Delta" }));

    expect(wallArtists()).toEqual(["Delta", "Bravo", "Charlie", "Alpha"]);
    expect(screen.getByRole("button", { name: "Custom Order" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
  });
});
