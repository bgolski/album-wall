import type { Album } from "@/types";
import { coverSources } from "./coverSource";
import { coverAddresses } from "./imageProxy";

// Longest wait for one cover before it is left out of the image.
const LOAD_TIMEOUT_MS = 8000;

/** Where a tile sits on the drawn canvas, in canvas pixels. */
export interface TileBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Loads an image the page may draw and read back, or resolves null when it cannot. */
export type ImageLoader = (src: string) => Promise<HTMLImageElement | null>;

/**
 * Loads an image with permission to read its pixels. A cover served without that permission fails
 * to load this way instead of loading and then spoiling the whole drawing.
 *
 * @param src Image address.
 * @returns The loaded image, or null when it fails or takes too long.
 */
export const loadReadableImage: ImageLoader = (src) =>
  new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    const timer = window.setTimeout(() => resolve(null), LOAD_TIMEOUT_MS);
    image.onload = () => {
      window.clearTimeout(timer);
      resolve(image.naturalWidth > 0 ? image : null);
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    image.src = src;
  });

/**
 * Draws the wall onto a canvas from the covers themselves rather than copying the page: each tile
 * is placed where it sits on screen, cropped to fill it and rounded like it. A cover the page may
 * not read is drawn as the placeholder instead.
 *
 * @param options.grid The wall grid element; its tiles carry `data-album-id`.
 * @param options.albums Albums on the wall, to find each tile's cover.
 * @param options.scale Output pixels per CSS pixel.
 * @param options.background Fill colour behind the tiles.
 * @param options.placeholder Image address drawn for a cover that cannot be included.
 * @param options.loadImage Loader to use; tests pass their own.
 * @returns The drawn canvas, how many covers were left out, and where each tile sits on it.
 */
export async function drawWall(options: {
  grid: HTMLElement;
  albums: Album[];
  scale: number;
  background: string;
  placeholder: string;
  loadImage?: ImageLoader;
}): Promise<{ canvas: HTMLCanvasElement; left: number; tiles: TileBox[] }> {
  const { grid, albums, scale, background, placeholder } = options;
  const loadImage = options.loadImage ?? loadReadableImage;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round((grid.offsetWidth || 1) * scale));
  canvas.height = Math.max(1, Math.round((grid.offsetHeight || 1) * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas drawing is not available");
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const byId = new Map(albums.map((album) => [String(album.id), album]));
  const tiles = Array.from(grid.querySelectorAll<HTMLElement>("[data-album-id]"));
  const sources = coverSources();
  const placeholderImage = await loadImage(placeholder);

  let left = 0;
  const images = await Promise.all(
    tiles.map(async (tile) => {
      const album = byId.get(tile.dataset.albumId ?? "");
      const cover = album?.cover_image || album?.coverUrl;
      if (!cover) return placeholderImage;
      for (const { src } of coverAddresses(cover, sources)) {
        const image = await loadImage(src);
        if (image) return image;
      }
      left += 1;
      return placeholderImage;
    })
  );

  const origin = grid.getBoundingClientRect();
  const boxes: TileBox[] = [];
  tiles.forEach((tile, index) => {
    const rect = tile.getBoundingClientRect();
    boxes.push({
      x: (rect.left - origin.left) * scale,
      y: (rect.top - origin.top) * scale,
      width: rect.width * scale,
      height: rect.height * scale,
    });
    const rounded = tile.querySelector<HTMLElement>(".rounded-tile") ?? tile;
    const radius = parseFloat(getComputedStyle(rounded).borderTopLeftRadius) || 0;
    drawTile(
      context,
      images[index] ?? null,
      (rect.left - origin.left) * scale,
      (rect.top - origin.top) * scale,
      rect.width * scale,
      rect.height * scale,
      radius * scale
    );
  });

  return { canvas, left, tiles: boxes };
}

// Draws an image filling the box (cropping the longer side, like `object-fit: cover`) inside
// rounded corners; with no image the box is left as the background.
function drawTile(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  if (!image || width <= 0 || height <= 0) return;
  const sourceWidth = image.naturalWidth || width;
  const sourceHeight = image.naturalHeight || height;
  const fill = Math.max(width / sourceWidth, height / sourceHeight);
  const cropWidth = width / fill;
  const cropHeight = height / fill;
  context.save();
  if (radius > 0 && typeof context.roundRect === "function") {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    context.clip();
  }
  context.drawImage(
    image,
    (sourceWidth - cropWidth) / 2,
    (sourceHeight - cropHeight) / 2,
    cropWidth,
    cropHeight,
    x,
    y,
    width,
    height
  );
  context.restore();
}
