import { describe, expect, it, vi } from "vitest";
import type { Album } from "@/types";
import { PosterError, requestPoster } from "./posterService";

const albums = [
  { id: 1, title: "A", artist: "x", cover_image: "https://i.discogs.com/a.jpg" },
  { id: 2, title: "B", artist: "y", cover_image: "https://coverartarchive.org/b.jpg" },
  { id: 3, title: "C", artist: "z" },
] as Album[];

const ok = (headers: Record<string, string> = {}) => new Response("jpeg", { status: 200, headers });

describe("requestPoster", () => {
  it("sends the wall's covers in order, one for each spot, empty where there is none", async () => {
    const fetcher = vi.fn(async () => ok({ "x-covers-left-out": "1" }));
    const { blob, coversLeftOut } = await requestPoster({
      albums,
      rows: 2,
      columns: 2,
      size: "18x24",
      background: "record",
      fetcher,
    });
    const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      size: "18x24",
      background: "record",
      rows: 2,
      columns: 2,
      covers: ["https://i.discogs.com/a.jpg", "https://coverartarchive.org/b.jpg", "", ""],
    });
    expect(await blob.text()).toBe("jpeg");
    expect(coversLeftOut).toBe(1);
  });

  it("says when the day's posters are used up", async () => {
    const fetcher = vi.fn(async () => new Response("no", { status: 429 }));
    await expect(
      requestPoster({ albums, rows: 1, columns: 3, size: "18x24", background: "dark", fetcher })
    ).rejects.toThrow(new PosterError("Posters are used up for today"));
  });

  it("says when the service fails or cannot be reached", async () => {
    await expect(
      requestPoster({
        albums,
        rows: 1,
        columns: 3,
        size: "18x24",
        background: "dark",
        fetcher: vi.fn(async () => new Response("x", { status: 500 })),
      })
    ).rejects.toThrow("Could not make the poster");
    await expect(
      requestPoster({
        albums,
        rows: 1,
        columns: 3,
        size: "18x24",
        background: "dark",
        fetcher: vi.fn(async () => {
          throw new TypeError("offline");
        }),
      })
    ).rejects.toThrow("Could not reach the poster service");
  });
});
