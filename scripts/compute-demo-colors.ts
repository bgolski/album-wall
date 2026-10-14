import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { coverProfile, type CoverProfile } from "../src/utils/coverProfile";
import { packProfile, type PackedProfile } from "../src/utils/colorCache";
import { getProxiedImageUrl, TILE_COVER_SIZE } from "../src/utils/imageProxy";

// Measures the profile of every demo cover (its most noticeable color, palette and region colors)
// and stores it in public/demo/collection.json, so the
// demo never has to read pixels in a visitor's browser. Run again after the demo list changes:
//   npx vite-node scripts/compute-demo-colors.ts && npx prettier --write public/demo/collection.json
// It needs Playwright's Chromium (npx playwright install chromium) and network access.
const file = "public/demo/collection.json";
const SAMPLE_SIZE = 64;

interface DemoAlbum {
  id: number;
  title: string;
  cover_image?: string;
  color?: { l: number; a: number; b: number };
  profile?: PackedProfile | CoverProfile;
}

const collection = JSON.parse(readFileSync(file, "utf8")) as { v: number; albums: DemoAlbum[] };
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("about:blank");

// The same measurement the app makes: a 32 pixel copy through the image proxy, drawn to a canvas.
async function readPixels(source: string): Promise<number[] | null> {
  return page.evaluate(
    ({ source, size }) =>
      new Promise<number[] | null>((resolve) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onerror = () => resolve(null);
        image.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size;
            const context = canvas.getContext("2d")!;
            context.drawImage(image, 0, 0, size, size);
            resolve(Array.from(context.getImageData(0, 0, size, size).data));
          } catch {
            resolve(null);
          }
        };
        image.src = source;
        setTimeout(() => resolve(null), 15000);
      }),
    { source, size: SAMPLE_SIZE }
  );
}

const failed: string[] = [];
for (let start = 0; start < collection.albums.length; start += 6) {
  await Promise.all(
    collection.albums.slice(start, start + 6).map(async (album) => {
      const cover = album.cover_image;
      // The image proxy sometimes refuses the small copy of a cover it serves at larger sizes, so
      // the app (and this script) fall back to the tile-sized copy.
      let pixels: number[] | null = null;
      for (const size of [SAMPLE_SIZE, TILE_COVER_SIZE]) {
        if (!cover || pixels) break;
        pixels = await readPixels(getProxiedImageUrl(cover, { size }));
      }
      const measured = pixels
        ? coverProfile(Uint8ClampedArray.from(pixels), SAMPLE_SIZE, SAMPLE_SIZE)
        : null;
      delete album.color;
      if (measured) album.profile = packProfile(measured);
      else {
        delete album.color;
        delete album.profile;
        failed.push(album.title);
      }
    })
  );
}
await browser.close();

// Pretty-print the list but keep each packed profile on one line, so the file stays small.
const packed = new Map<string, string>();
collection.albums.forEach((album, index) => {
  if (!album.profile) return;
  const marker = `__profile_${index}__`;
  packed.set(`"${marker}"`, JSON.stringify(album.profile));
  (album as { profile?: unknown }).profile = marker;
});
let text = JSON.stringify(collection, null, 2);
for (const [marker, value] of packed) text = text.replace(marker, value);
writeFileSync(file, text + "\n");
console.log(
  `Measured ${collection.albums.length - failed.length} of ${collection.albums.length} covers`
);
if (failed.length > 0) {
  // Not an error: the app measures any cover that has no stored color when it is first needed.
  console.warn(`No color stored for: ${failed.join(", ")} (the app measures these itself)`);
}
