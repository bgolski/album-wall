import { coverProfile, type CoverProfile } from "./coverProfile";
import { getProxiedImageUrl, TILE_COVER_SIZE } from "./imageProxy";

/** Side of the small copy of a cover that is measured, in pixels. */
const SAMPLE_SIZE = 64;

/** Measures one copy of a cover: its profile, `null` when its pixels are not readable, or `"unavailable"` when it did not load. */
function measureCopy(
  coverUrl: string,
  copySize: number,
  timeoutMs: number
): Promise<CoverProfile | null | "unavailable"> {
  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (outcome: CoverProfile | null | "unavailable") => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      resolve(outcome);
    };
    const timer = setTimeout(() => finish("unavailable"), timeoutMs);

    image.crossOrigin = "anonymous";
    image.onerror = () => finish("unavailable");
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = SAMPLE_SIZE;
        canvas.height = SAMPLE_SIZE;
        const context = canvas.getContext("2d");
        if (!context) return finish(null);
        context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        finish(
          coverProfile(
            context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data,
            SAMPLE_SIZE,
            SAMPLE_SIZE
          )
        );
      } catch {
        finish(null); // pixels are not readable
      }
    };
    image.src = getProxiedImageUrl(coverUrl, { size: copySize });
  });
}

/**
 * Measures a cover's profile (its most noticeable color, palette and region colors) from a small
 * copy of it. The copy comes through the image proxy, which
 * allows reading its pixels, and is normally a couple of kilobytes. The proxy sometimes refuses a
 * size for a cover it serves at another, so a copy that does not load is retried at the tile size
 * the wall already shows, which the browser has usually kept.
 *
 * @param coverUrl Original cover address.
 * @param timeoutMs How long to wait for each copy before giving up on it.
 * @returns The cover's profile, or `null` when it cannot be loaded or read.
 */
export async function readCoverProfile(
  coverUrl: string,
  timeoutMs = 8000
): Promise<CoverProfile | null> {
  if (!coverUrl) return null;
  for (const copySize of [SAMPLE_SIZE, TILE_COVER_SIZE]) {
    const outcome = await measureCopy(coverUrl, copySize, timeoutMs);
    if (outcome !== "unavailable") return outcome;
  }
  return null;
}
