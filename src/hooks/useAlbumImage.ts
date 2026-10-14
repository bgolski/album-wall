import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Album } from "@/types";
import { getProxiedImageUrl, DEFAULT_PLACEHOLDER_IMAGE } from "@/utils/imageProxy";
import {
  coverSource,
  reportCoverLoad,
  subscribeToCoverSource,
  type CoverSource,
} from "@/utils/coverSource";

const startOnProxy = (): CoverSource => "proxy";

/**
 * Resolves album artwork for display.
 *
 * A cover is tried through the image proxy first and then at its own address, so it still shows
 * when the proxy fails; when the proxy has been failing for everyone, new covers go straight to
 * their own address. A cover that has loaded keeps its image even if that changes.
 *
 * @param album Album whose artwork should be displayed.
 * @param imageSize When provided, requests a proxied copy at this pixel size for tile displays.
 * @returns Image source state, whether a cover the album has could not be shown, a wrapper ref,
 *          and load/error handlers for the image element.
 */
export function useAlbumImage(album: Album, imageSize?: number) {
  const coverImage = album.cover_image || album.coverUrl;
  const source = useSyncExternalStore(subscribeToCoverSource, coverSource, startOnProxy);

  // Memoize by cover URL and requested size.
  const proxiedUrl = useMemo(() => {
    if (!coverImage) return "";
    return imageSize != null
      ? getProxiedImageUrl(coverImage, { size: imageSize })
      : getProxiedImageUrl(coverImage);
  }, [coverImage, imageSize]);

  // Addresses to try, best first.
  const candidates = useMemo(() => {
    if (!coverImage) return [];
    return source === "proxy" ? [proxiedUrl, coverImage] : [coverImage];
  }, [coverImage, proxiedUrl, source]);

  // What failed and what loaded are tied to the image being asked for, so a new album or size
  // starts clean by itself.
  const key = `${coverImage ?? ""}|${imageSize ?? ""}`;
  const [failed, setFailed] = useState<{ key: string; urls: string[] }>({ key: "", urls: [] });
  const [loaded, setLoaded] = useState<{ key: string; url: string } | null>(null);
  const imgRef = useRef<HTMLDivElement>(null);

  const failedHere = failed.key === key ? failed.urls : [];
  const keptUrl = loaded && loaded.key === key ? loaded.url : null;
  const sourceUrl = keptUrl ?? candidates.find((url) => !failedHere.includes(url)) ?? "";
  const imageError = !sourceUrl;
  const kindOf = (url: string): CoverSource => (url === proxiedUrl ? "proxy" : "direct");

  /**
   * Moves on to the next address for the cover, or to the placeholder artwork when none is left.
   */
  const handleImageError = () => {
    if (!sourceUrl) return;
    reportCoverLoad(kindOf(sourceUrl), false);
    setFailed({ key, urls: [...failedHere, sourceUrl] });
  };

  /**
   * Notes that the cover loaded, so it keeps this image.
   */
  const handleImageLoad = () => {
    if (!sourceUrl || keptUrl) return;
    reportCoverLoad(kindOf(sourceUrl), true);
    setLoaded({ key, url: sourceUrl });
  };

  return {
    imageSource: imageError ? DEFAULT_PLACEHOLDER_IMAGE : sourceUrl,
    imageError,
    /** The album has a cover, but it could not be shown (the placeholder is showing instead). */
    coverMissing: Boolean(coverImage) && imageError,
    imgRef,
    handleImageError,
    handleImageLoad,
  };
}
