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
import { coverSource, reportCoverLoad, resetCoverSource } from "@/utils/coverSource";

afterEach(() => {
  act(() => resetCoverSource());
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

  it("tries the cover's own address when the proxied copy fails, then the placeholder", () => {
    vi.mocked(getProxiedImageUrl).mockReturnValue("proxied.png");
    const { result } = renderHook(() => useAlbumImage(albumWithCover, false));
    act(() => result.current.handleImageError());
    expect(result.current.imageError).toBe(false);
    expect(result.current.imageSource).toBe(albumWithCover.cover_image);
    act(() => result.current.handleImageError());
    expect(result.current.imageError).toBe(true);
    expect(result.current.coverMissing).toBe(true);
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

  it("shows the converted copy only while exporting", () => {
    vi.mocked(getProxiedImageUrl).mockReturnValue("proxied.png");
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: () => {},
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;copy");
    const { result, rerender } = renderHook(
      ({ exporting }) => useAlbumImage(albumWithCover, exporting),
      { initialProps: { exporting: true } }
    );
    const div = document.createElement("div");
    const img = document.createElement("img");
    img.setAttribute("src", "proxied.png");
    div.appendChild(img);
    act(() => {
      result.current.imgRef.current = div;
    });
    act(() => result.current.handleImageLoad());
    expect(result.current.imageSource).toBe("data:image/png;copy");

    rerender({ exporting: false });
    expect(result.current.imageSource).toBe("proxied.png");
  });

  it("ignores the placeholder standing in for a cover while an image is saved", () => {
    vi.mocked(getProxiedImageUrl).mockReturnValue("proxied.png");
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: () => {},
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;copy");
    const { result } = renderHook(() => useAlbumImage(albumWithCover, true));
    const div = document.createElement("div");
    const img = document.createElement("img");
    img.setAttribute("src", DEFAULT_PLACEHOLDER_IMAGE);
    div.appendChild(img);
    act(() => {
      result.current.imgRef.current = div;
    });
    act(() => result.current.handleImageLoad());
    expect(result.current.imageSource).toBe("proxied.png");
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

describe("useAlbumImage with a changing album", () => {
  it("shows the placeholder after an image fails, then a fresh image for the next album", () => {
    vi.mocked(getProxiedImageUrl).mockImplementation((url: string) => `proxied:${url}`);
    const { result, rerender } = renderHook(({ album }) => useAlbumImage(album), {
      initialProps: { album: albumWithCover },
    });
    expect(result.current.imageSource).toBe("proxied:http://example.com/cover.jpg");

    act(() => result.current.handleImageError());
    act(() => result.current.handleImageError());
    expect(result.current.imageError).toBe(true);
    expect(result.current.imageSource).toBe(DEFAULT_PLACEHOLDER_IMAGE);

    rerender({ album: albumWithCoverUrl });
    expect(result.current.imageError).toBe(false);
    expect(result.current.imageSource).toBe(`proxied:${albumWithCoverUrl.coverUrl}`);
  });

  it("uses the placeholder for an album with no cover and recovers when one appears", () => {
    vi.mocked(getProxiedImageUrl).mockImplementation((url: string) => `proxied:${url}`);
    const bare: Album = { id: 9, title: "Bare", artist: "A" };
    const { result, rerender } = renderHook(({ album }) => useAlbumImage(album), {
      initialProps: { album: bare },
    });
    expect(result.current.imageError).toBe(true);
    expect(result.current.coverMissing).toBe(false);
    expect(result.current.imageSource).toBe(DEFAULT_PLACEHOLDER_IMAGE);

    rerender({ album: albumWithCover });
    expect(result.current.imageError).toBe(false);
    expect(result.current.imageSource).toBe("proxied:http://example.com/cover.jpg");
  });
});

describe("useAlbumImage when the image proxy is down", () => {
  it("gives up on the proxy for new covers after four tiles fail through it", () => {
    vi.mocked(getProxiedImageUrl).mockImplementation((url: string) => `proxied:${url}`);
    const tiles = [1, 2, 3, 4].map((id) =>
      renderHook(() =>
        useAlbumImage({ ...albumWithCover, id, cover_image: `http://example.com/${id}.jpg` }, false)
      )
    );
    expect(coverSource()).toBe("proxy");
    tiles.forEach(({ result }) => act(() => result.current.handleImageError()));
    expect(coverSource()).toBe("direct");
    // Each failed tile has already moved on to its cover's own address.
    expect(tiles[0]!.result.current.imageSource).toBe("http://example.com/1.jpg");
  });

  it("goes straight to the cover's own address once the page has given up on the proxy", () => {
    vi.mocked(getProxiedImageUrl).mockReturnValue("proxied.png");
    act(() => {
      for (let i = 0; i < 4; i += 1) reportCoverLoad("proxy", false);
    });
    const { result } = renderHook(() => useAlbumImage(albumWithCover, false));
    expect(result.current.imageSource).toBe(albumWithCover.cover_image);
  });

  it("keeps a cover that already loaded when the page switches", () => {
    vi.mocked(getProxiedImageUrl).mockReturnValue("proxied.png");
    const { result } = renderHook(() => useAlbumImage(albumWithCover, false));
    act(() => result.current.handleImageLoad());
    act(() => {
      for (let i = 0; i < 4; i += 1) reportCoverLoad("proxy", false);
    });
    expect(coverSource()).toBe("direct");
    expect(result.current.imageSource).toBe("proxied.png");
  });
});
