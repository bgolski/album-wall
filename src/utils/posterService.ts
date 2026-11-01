import type { Album } from "@/types";

import type { PosterSize } from "./posterLayout";

export type { PosterSize };
export const POSTER_SIZES: readonly { id: PosterSize; label: string }[] = [
  { id: "18x24", label: "18 × 24" },
  { id: "24x36", label: "24 × 36" },
];

/**
 * Where posters are made: the app's own service on the short link domain. An empty value turns
 * posters off.
 */
const POSTER_SERVICE =
  process.env.NEXT_PUBLIC_POSTER_SERVICE_URL ?? "https://albumwall.bradleygolski.com/poster";

/** Why a poster could not be made, in words for the screen. */
export class PosterError extends Error {}

const REQUEST_TIMEOUT_MS = 90_000;

/**
 * Asks the poster service to draw the wall at print size.
 *
 * @param input.albums The albums on the wall, in order.
 * @param input.background Dark, light, or the record behind the wall.
 * @param input.fetcher The fetch to use; tests pass their own.
 * @returns The JPEG, and how many covers it had to leave out.
 * @throws PosterError saying what went wrong.
 */
export async function requestPoster(input: {
  albums: Album[];
  rows: number;
  columns: number;
  size: PosterSize;
  background: "dark" | "light" | "record";
  fetcher?: typeof fetch;
}): Promise<{ blob: Blob; coversLeftOut: number }> {
  if (!POSTER_SERVICE) throw new PosterError("Posters are not available here");
  const { albums, rows, columns, size, background } = input;
  const covers = Array.from({ length: rows * columns }, (_, index) => {
    const album = albums[index];
    return album?.cover_image || "";
  });

  let response: Response;
  try {
    response = await (input.fetcher ?? fetch)(POSTER_SERVICE, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ size, background, rows, columns, covers }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new PosterError("Could not reach the poster service");
  }
  if (response.status === 429) throw new PosterError("Posters are used up for today");
  if (!response.ok) throw new PosterError("Could not make the poster");

  let blob: Blob;
  try {
    blob = await response.blob();
  } catch {
    throw new PosterError("Could not make the poster");
  }
  const left = Number(response.headers.get("x-covers-left-out"));
  return { blob, coversLeftOut: Number.isFinite(left) ? left : 0 };
}
