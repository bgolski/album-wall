import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAlbumImage } from "./useAlbumImage";
import { getProxiedImageUrl, getServiceImageUrl } from "@/utils/imageProxy";
import type { Album } from "@/types";

const album: Album = {
  id: 1,
  title: "Test record",
  artist: "Test artist",
  cover_image: "https://i.discogs.com/abc/R-1-1.jpeg",
};

describe("wall artwork sizing", () => {
  it("requests a tile-sized image and keeps the URL across unchanged rerenders", () => {
    const { result, rerender } = renderHook(() => useAlbumImage(album, 320));
    const first = result.current.imageSource;
    expect(first).toBe(getServiceImageUrl(album.cover_image!, { size: 320 }));
    expect(first).toContain("w=320");
    rerender();
    expect(result.current.imageSource).toBe(first);
  });

  it("asks for the largest copy when no tile size is supplied", () => {
    const { result } = renderHook(() => useAlbumImage(album));
    expect(result.current.imageSource).toBe(getServiceImageUrl(album.cover_image!));
    expect(getProxiedImageUrl(album.cover_image!)).not.toContain("&w=");
  });
});
