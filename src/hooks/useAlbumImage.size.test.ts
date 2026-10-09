import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAlbumImage } from "./useAlbumImage";
import { getProxiedImageUrl } from "@/utils/imageProxy";
import type { Album } from "@/types";

vi.mock("@/utils/imageProxy", () => ({
  getProxiedImageUrl: vi.fn((url: string, options?: { size?: number }) =>
    options?.size ? `${url}?size=${options.size}` : url
  ),
  DEFAULT_PLACEHOLDER_IMAGE: "placeholder.png",
}));

const album: Album = {
  id: 1,
  title: "Test record",
  artist: "Test artist",
  cover_image: "https://example.com/cover.jpg",
};

afterEach(() => vi.clearAllMocks());

describe("wall artwork sizing", () => {
  it("requests a tile-sized image and memoizes the URL across unchanged rerenders", () => {
    const { result, rerender } = renderHook(() => useAlbumImage(album, false, 320));
    expect(result.current.imageSource).toBe("https://example.com/cover.jpg?size=320");
    expect(getProxiedImageUrl).toHaveBeenCalledWith(album.cover_image, {
      size: 320,
    });
    rerender();
    expect(getProxiedImageUrl).toHaveBeenCalledTimes(1);
  });

  it("uses the original image in export mode even when a tile size is supplied", () => {
    const { result } = renderHook(() => useAlbumImage(album, true, 320));
    expect(result.current.imageSource).toBe(album.cover_image);
    expect(getProxiedImageUrl).toHaveBeenCalledWith(album.cover_image);
  });

  it("keeps the original image when no tile size is supplied", () => {
    const { result } = renderHook(() => useAlbumImage(album));
    expect(result.current.imageSource).toBe(album.cover_image);
    expect(getProxiedImageUrl).toHaveBeenCalledWith(album.cover_image);
  });
});
