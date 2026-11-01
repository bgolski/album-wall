import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAlbumImage } from "./useAlbumImage";
import { Album } from "@/types";
import {
  getProxiedImageUrl,
  getServiceImageUrl,
  DEFAULT_PLACEHOLDER_IMAGE,
} from "@/covers/imageProxy";
import { coverSources, reportCoverLoad, resetCoverSource } from "@/covers/coverSource";

afterEach(() => {
  act(() => resetCoverSource());
  vi.restoreAllMocks();
});

// The image service serves Discogs covers; other hosts go through the proxy.
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
  cover_image: "http://example.com/coverurl.jpg",
};

const albumWithoutCover: Album = {
  id: 3,
  title: "Album Without Cover",
  artist: "Artist",
};

const discogsAlbum: Album = {
  id: 4,
  title: "Discogs Album",
  artist: "Artist",
  cover_image: "https://i.discogs.com/abc/R-4-1.jpeg",
};

const proxied = (url: string) => getProxiedImageUrl(url);

describe("useAlbumImage hook", () => {
  it("starts with the proxied copy for a cover the image service does not serve", () => {
    const { result } = renderHook(() => useAlbumImage(albumWithCover));
    expect(result.current.imageSource).toBe(proxied(albumWithCover.cover_image!));
    expect(result.current.imageError).toBe(false);
  });

  it("falls back to placeholder when album has no cover", () => {
    const { result } = renderHook(() => useAlbumImage(albumWithoutCover));
    expect(result.current.imageError).toBe(true);
    expect(result.current.imageSource).toBe(DEFAULT_PLACEHOLDER_IMAGE);
  });

  it("tries the cover's own address when the proxied copy fails, then the placeholder", () => {
    const { result } = renderHook(() => useAlbumImage(albumWithCover));
    act(() => result.current.handleImageError());
    expect(result.current.imageError).toBe(false);
    expect(result.current.imageSource).toBe(albumWithCover.cover_image);
    act(() => result.current.handleImageError());
    expect(result.current.imageError).toBe(true);
    expect(result.current.coverMissing).toBe(true);
    expect(result.current.imageSource).toBe(DEFAULT_PLACEHOLDER_IMAGE);
  });

  it("tries the image service, then the proxy, then the original for a Discogs cover", () => {
    const cover = discogsAlbum.cover_image!;
    const { result } = renderHook(() => useAlbumImage(discogsAlbum, 320));
    expect(result.current.imageSource).toBe(getServiceImageUrl(cover, { size: 320 }));
    act(() => result.current.handleImageError());
    expect(result.current.imageSource).toBe(getProxiedImageUrl(cover, { size: 320 }));
    act(() => result.current.handleImageError());
    expect(result.current.imageSource).toBe(cover);
  });

  it("updates imageSource when album prop changes", () => {
    const { result, rerender } = renderHook(({ album }) => useAlbumImage(album), {
      initialProps: { album: albumWithCover },
    });
    expect(result.current.imageSource).toBe(proxied(albumWithCover.cover_image!));
    rerender({ album: albumWithCoverUrl });
    expect(result.current.imageSource).toBe(proxied(albumWithCoverUrl.cover_image!));
  });
});

describe("useAlbumImage with a changing album", () => {
  it("shows the placeholder after an image fails, then a fresh image for the next album", () => {
    const { result, rerender } = renderHook(({ album }) => useAlbumImage(album), {
      initialProps: { album: albumWithCover },
    });
    act(() => result.current.handleImageError());
    act(() => result.current.handleImageError());
    expect(result.current.imageError).toBe(true);
    expect(result.current.imageSource).toBe(DEFAULT_PLACEHOLDER_IMAGE);

    rerender({ album: albumWithCoverUrl });
    expect(result.current.imageError).toBe(false);
    expect(result.current.imageSource).toBe(proxied(albumWithCoverUrl.cover_image!));
  });

  it("uses the placeholder for an album with no cover and recovers when one appears", () => {
    const bare: Album = { id: 9, title: "Bare", artist: "A" };
    const { result, rerender } = renderHook(({ album }) => useAlbumImage(album), {
      initialProps: { album: bare },
    });
    expect(result.current.imageError).toBe(true);
    expect(result.current.coverMissing).toBe(false);
    expect(result.current.imageSource).toBe(DEFAULT_PLACEHOLDER_IMAGE);

    rerender({ album: albumWithCover });
    expect(result.current.imageError).toBe(false);
    expect(result.current.imageSource).toBe(proxied(albumWithCover.cover_image!));
  });
});

describe("useAlbumImage when an image service is down", () => {
  const tiles = (count: number, host: string) =>
    Array.from({ length: count }, (_, i) =>
      renderHook(() =>
        useAlbumImage({ ...albumWithCover, id: i + 1, cover_image: `${host}/${i + 1}.jpg` })
      )
    );

  it("gives up on the proxy for new covers after four tiles fail through it", () => {
    const wall = tiles(4, "http://example.com");
    wall.forEach(({ result }) => act(() => result.current.handleImageError()));
    expect(coverSources()).toEqual(["service", "direct"]);
    // Each failed tile has already moved on to its cover's own address.
    expect(wall[0]!.result.current.imageSource).toBe("http://example.com/1.jpg");
  });

  it("skips the image service for new covers after four tiles fail through it", () => {
    const wall = tiles(4, "https://i.discogs.com");
    wall.forEach(({ result }) => act(() => result.current.handleImageError()));
    expect(coverSources()).toEqual(["proxy", "direct"]);
    expect(wall[0]!.result.current.imageSource).toBe(proxied("https://i.discogs.com/1.jpg"));
    const { result } = renderHook(() => useAlbumImage(discogsAlbum));
    expect(result.current.imageSource).toBe(proxied(discogsAlbum.cover_image!));
  });

  it("goes straight to the cover's own address once the page has given up on both", () => {
    act(() => {
      for (let i = 0; i < 4; i += 1) reportCoverLoad("service", false);
      for (let i = 0; i < 4; i += 1) reportCoverLoad("proxy", false);
    });
    const { result } = renderHook(() => useAlbumImage(discogsAlbum));
    expect(result.current.imageSource).toBe(discogsAlbum.cover_image);
  });

  it("keeps a cover that already loaded when the page switches", () => {
    const { result } = renderHook(() => useAlbumImage(discogsAlbum));
    const loaded = result.current.imageSource;
    act(() => result.current.handleImageLoad());
    act(() => {
      for (let i = 0; i < 4; i += 1) reportCoverLoad("service", false);
    });
    expect(coverSources()).toEqual(["proxy", "direct"]);
    expect(result.current.imageSource).toBe(loaded);
  });
});
