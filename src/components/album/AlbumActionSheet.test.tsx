import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { hexToOklab } from "@/utils/gradientTargets";
import { AlbumActionSheet } from "./AlbumActionSheet";

afterEach(cleanup);

describe("AlbumActionSheet cover colors", () => {
  const base = {
    album: { id: 1, title: "Igor", artist: "Tyler, The Creator" },
    isPinned: false,
    canPin: true,
    onClose: () => {},
    onTogglePin: () => {},
    onMove: () => {},
  };

  it("shows the main colors Sort by Color read from the cover, by name and share", () => {
    const pink = hexToOklab("#df9eba")!;
    const black = hexToOklab("#211f25")!;
    render(
      <AlbumActionSheet
        {...base}
        colorProfile={{
          color: pink,
          palette: [
            { color: pink, share: 0.55 },
            { color: black, share: 0.35 },
            { color: hexToOklab("#00ff00")!, share: 0.04 },
            { color: hexToOklab("#2a2a2a")!, share: 0.06 },
          ],
          regions: [],
        }}
      />
    );
    expect(screen.getByText("Colors Sort by Color sees")).toBeTruthy();
    const items = screen.getAllByRole("listitem").map((item) => item.textContent);
    // Two shades of black are one color: 35% + 6%.
    expect(items).toEqual(["pink 55%", "black 41%"]);
  });

  it("says when no colors could be read, and shows nothing outside Sort by Color", () => {
    const { rerender } = render(<AlbumActionSheet {...base} colorProfile={null} />);
    expect(screen.getByText("Sort by Color could not read the colors of this cover.")).toBeTruthy();
    rerender(<AlbumActionSheet {...base} />);
    expect(screen.queryByText(/Sort by Color/)).toBeNull();
  });
});
