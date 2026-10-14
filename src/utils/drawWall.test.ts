import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { drawWall, type ImageLoader } from "./drawWall";
import { reportCoverLoad, resetCoverSource } from "./coverSource";
import { getProxiedImageUrl } from "./imageProxy";
import type { Album } from "@/types";

afterEach(() => {
  act(() => resetCoverSource());
  vi.restoreAllMocks();
});

function fakeContext() {
  return {
    fillStyle: "",
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    roundRect: vi.fn(),
    clip: vi.fn(),
  };
}

// A grid of tiles laid out left to right, each `size` CSS pixels square with a `gap` between.
function wall(ids: number[], size = 100, gap = 10, radius = "10px") {
  const grid = document.createElement("div");
  Object.defineProperty(grid, "offsetWidth", { value: ids.length * size + (ids.length - 1) * gap });
  Object.defineProperty(grid, "offsetHeight", { value: size });
  grid.getBoundingClientRect = () => ({ left: 50, top: 20 }) as DOMRect;
  ids.forEach((id, index) => {
    const tile = document.createElement("div");
    tile.dataset.albumId = String(id);
    const left = 50 + index * (size + gap);
    tile.getBoundingClientRect = () => ({ left, top: 20, width: size, height: size }) as DOMRect;
    const inner = document.createElement("div");
    inner.className = "rounded-tile";
    inner.style.borderTopLeftRadius = radius;
    tile.appendChild(inner);
    grid.appendChild(tile);
  });
  return grid;
}

const image = (name: string, width = 600, height = 600) =>
  ({ name, naturalWidth: width, naturalHeight: height }) as unknown as HTMLImageElement;

const album = (id: number, cover?: string): Album => ({
  id,
  title: `A${id}`,
  artist: "B",
  ...(cover ? { cover_image: cover } : {}),
});

function setup() {
  const context = fakeContext();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D
  );
  return context;
}

describe("drawWall", () => {
  it("draws each cover where its tile sits, scaled, rounded and over the background", async () => {
    const context = setup();
    const loads: string[] = [];
    const loadImage: ImageLoader = async (src) => {
      loads.push(src);
      return image(src);
    };
    const { canvas, left } = await drawWall({
      grid: wall([1, 2]),
      albums: [album(1, "https://x/1.jpg"), album(2, "https://x/2.jpg")],
      scale: 2,
      background: "#123456",
      placeholder: "placeholder",
      loadImage,
    });

    expect([canvas.width, canvas.height]).toEqual([420, 200]);
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 420, 200);
    expect(context.fillStyle).toBe("#123456");
    expect(left).toBe(0);
    expect(loads).toContain(getProxiedImageUrl("https://x/1.jpg"));
    const [first, second] = context.drawImage.mock.calls;
    expect(first!.slice(5)).toEqual([0, 0, 200, 200]);
    expect(second!.slice(5)).toEqual([220, 0, 200, 200]);
    expect(context.roundRect).toHaveBeenCalledWith(0, 0, 200, 200, 20);
  });

  it("crops a cover that is not square to fill its tile", async () => {
    const context = setup();
    await drawWall({
      grid: wall([1]),
      albums: [album(1, "https://x/1.jpg")],
      scale: 1,
      background: "#000",
      placeholder: "placeholder",
      loadImage: async (src) => (src === "placeholder" ? image(src) : image(src, 800, 400)),
    });
    // The middle 400 x 400 of an 800 x 400 cover.
    expect(context.drawImage.mock.calls[0]!.slice(1, 5)).toEqual([200, 0, 400, 400]);
  });

  it("tries the cover's own address when the image service copy fails", async () => {
    setup();
    const loads: string[] = [];
    const { left } = await drawWall({
      grid: wall([1]),
      albums: [album(1, "https://x/1.jpg")],
      scale: 1,
      background: "#000",
      placeholder: "placeholder",
      loadImage: async (src) => {
        loads.push(src);
        return src === "https://x/1.jpg" || src === "placeholder" ? image(src) : null;
      },
    });
    expect(left).toBe(0);
    expect(loads).toEqual([
      "placeholder",
      getProxiedImageUrl("https://x/1.jpg"),
      "https://x/1.jpg",
    ]);
  });

  it("goes straight to the cover's own address once the page has given up on the image service", async () => {
    setup();
    act(() => {
      for (let i = 0; i < 4; i += 1) reportCoverLoad("proxy", false);
    });
    const loads: string[] = [];
    await drawWall({
      grid: wall([1]),
      albums: [album(1, "https://x/1.jpg")],
      scale: 1,
      background: "#000",
      placeholder: "placeholder",
      loadImage: async (src) => {
        loads.push(src);
        return image(src);
      },
    });
    expect(loads).toEqual(["placeholder", "https://x/1.jpg"]);
  });

  it("draws the placeholder for a cover it may not read and counts it", async () => {
    const context = setup();
    const { left } = await drawWall({
      grid: wall([1, 2]),
      albums: [album(1, "https://x/1.jpg"), album(2, "https://x/2.jpg")],
      scale: 1,
      background: "#000",
      placeholder: "placeholder",
      loadImage: async (src) => (src.includes("2.jpg") ? null : image(src)),
    });
    expect(left).toBe(1);
    const drawn = context.drawImage.mock.calls.map((call) => (call[0] as { name: string }).name);
    expect(drawn[1]).toBe("placeholder");
  });

  it("draws the placeholder without counting it for an album that has no cover", async () => {
    const context = setup();
    const { left } = await drawWall({
      grid: wall([1]),
      albums: [album(1)],
      scale: 1,
      background: "#000",
      placeholder: "placeholder",
      loadImage: async (src) => image(src),
    });
    expect(left).toBe(0);
    expect((context.drawImage.mock.calls[0]![0] as { name: string }).name).toBe("placeholder");
  });
});
