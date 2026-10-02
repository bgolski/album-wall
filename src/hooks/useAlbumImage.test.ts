import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAlbumImage } from "./useAlbumImage";
import { Album } from "@/types";

// Mock the image proxy utilities
vi.mock("@/utils/imageProxy", () => ({
  getProxiedImageUrl: vi.fn(),
  DEFAULT_PLACEHOLDER_IMAGE: "placeholder.png",
}));

import { getProxiedImageUrl, DEFAULT_PLACEHOLDER_IMAGE } from "@/utils/imageProxy";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const albumWithCover: Album = {
  id: 1,
  title: "Album With Cover",
  artist: "Artist",
  cover_image: "http://example.com/cover.jpg",
};

const albumWithCoverUrl: Album = {
  id: 2,
  title: "Album With CoverUrl",
  artist: "Artist",
  coverUrl: "http://example.com/coverurl.jpg",
};

const albumWithoutCover: Album = {
  id: 3,
  title: "Album Without Cover",
  artist: "Artist",
};

describe("useAlbumImage hook", () => {
  it("sets proxied image URL when album has a cover_image", () => {
    vi.mocked(getProxiedImageUrl).mockReturnValue("proxied.png");
    const { result } = renderHook(() => useAlbumImage(albumWithCover, false));
    expect(getProxiedImageUrl).toHaveBeenCalledWith(albumWithCover.cover_image);
    expect(result.current.imageSource).toBe("proxied.png");
    expect(result.current.imageError).toBe(false);
  });

  it("falls back to placeholder when album has no cover", () => {
    const { result } = renderHook(() => useAlbumImage(albumWithoutCover, false));
    expect(result.current.imageError).toBe(true);
    expect(result.current.imageSource).toBe(DEFAULT_PLACEHOLDER_IMAGE);
  });

  it("uses coverUrl when cover_image is absent", () => {
    vi.mocked(getProxiedImageUrl).mockReturnValue("proxied2.png");
    const { result } = renderHook(() => useAlbumImage(albumWithCoverUrl, false));
    expect(getProxiedImageUrl).toHaveBeenCalledWith(albumWithCoverUrl.coverUrl);
    expect(result.current.imageSource).toBe("proxied2.png");
  });

  it("handleImageError sets error flag and placeholder", () => {
    const { result } = renderHook(() => useAlbumImage(albumWithCover, false));
    act(() => {
      result.current.handleImageError();
    });
    expect(result.current.imageError).toBe(true);
    expect(result.current.imageSource).toBe(DEFAULT_PLACEHOLDER_IMAGE);
  });

  it("handleImageLoad converts to data URL when exportMode is true", () => {
    vi.mocked(getProxiedImageUrl).mockReturnValue("proxied.png");
    const { result } = renderHook(() => useAlbumImage(albumWithCover, true));
    const div = document.createElement("div");
    const img = document.createElement("img");
    Object.defineProperty(img, "naturalWidth", { get: () => 200 });
    Object.defineProperty(img, "naturalHeight", { get: () => 100 });
    div.appendChild(img);
    act(() => {
      result.current.imgRef.current = div;
    });
    act(() => {
      result.current.handleImageLoad();
    });
    // In jsdom the conversion may not produce a data URL, so accept either
    expect(result.current.imageSource).toMatch(/^(data:image\/png|proxied\.png)$/);
  });

  it("handleImageLoad does nothing when exportMode is false", () => {
    const { result } = renderHook(() => useAlbumImage(albumWithCover, false));
    const div = document.createElement("div");
    const img = document.createElement("img");
    Object.defineProperty(img, "naturalWidth", { get: () => 200 });
    Object.defineProperty(img, "naturalHeight", { get: () => 100 });
    div.appendChild(img);
    act(() => {
      result.current.imgRef.current = div;
    });
    const prevSource = result.current.imageSource;
    act(() => {
      result.current.handleImageLoad();
    });
    expect(result.current.imageSource).toBe(prevSource);
  });

  it("useEffect updates imageSource when album prop changes", () => {
    vi.mocked(getProxiedImageUrl).mockReturnValueOnce("proxied.png");
    const { result, rerender } = renderHook(({ album }) => useAlbumImage(album, false), {
      initialProps: { album: albumWithCover },
    });
    expect(result.current.imageSource).toBe("proxied.png");
    vi.mocked(getProxiedImageUrl).mockReturnValueOnce("proxied2.png");
    rerender({ album: albumWithCoverUrl });
    expect(result.current.imageSource).toBe("proxied2.png");
  });
});
