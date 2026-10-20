import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { Album } from "@/types";
import { posterLayout } from "@/utils/posterLayout";
import { PosterPreview } from "./PosterPreview";

afterEach(cleanup);

const albums = Array.from({ length: 8 }, (_, index) => ({
  id: index + 1,
  title: `Album ${index + 1}`,
  artist: "Artist",
  cover_image: `https://example.test/${index + 1}.jpg`,
})) as Album[];

const dark = { color: "#0b0f17", record: false };

describe("PosterPreview", () => {
  it("places each cover where the poster service puts it, as shares of the poster", () => {
    render(<PosterPreview albums={albums} rows={2} columns={4} size="18x24" backdrop={dark} />);
    const layout = posterLayout("18x24", 2, 4);
    const covers = screen.getAllByTestId("poster-cover");
    expect(covers).toHaveLength(8);
    // The second cover of the first row, and the first of the second row.
    expect(parseFloat(covers[1]!.style.left)).toBeCloseTo(
      ((layout.left + layout.tile + layout.gap) / layout.width) * 100,
      2
    );
    expect(parseFloat(covers[4]!.style.top)).toBeCloseTo(
      ((layout.top + layout.tile + layout.gap) / layout.height) * 100,
      2
    );
    expect(parseFloat(covers[0]!.style.width)).toBeCloseTo((layout.tile / layout.width) * 100, 2);
    expect(covers[0]!.style.borderRadius).toBe("7%");
  });

  it("is the shape of the poster: upright for a tall wall, sideways for a wide one", () => {
    const { rerender } = render(
      <PosterPreview albums={albums} rows={4} columns={2} size="24x36" backdrop={dark} />
    );
    expect(screen.getByTestId("export-preview").style.aspectRatio).toBe("7200 / 10800");
    rerender(<PosterPreview albums={albums} rows={2} columns={4} size="24x36" backdrop={dark} />);
    expect(screen.getByTestId("export-preview").style.aspectRatio).toBe("10800 / 7200");
  });

  it("draws the record behind the covers when asked", () => {
    const context = {
      fillStyle: "",
      fillRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      stroke: vi.fn(),
      strokeStyle: "",
      lineWidth: 0,
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      context as unknown as CanvasRenderingContext2D
    );
    render(
      <PosterPreview
        albums={albums}
        rows={2}
        columns={4}
        size="18x24"
        backdrop={{ color: "#0b0f17", record: true }}
      />
    );
    expect(context.arc).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
