import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Album } from "@/types";
import { coverAddresses, DEFAULT_PLACEHOLDER_IMAGE } from "@/covers/imageProxy";
import {
  ALL_COVER_SOURCES,
  coverSources,
  reportCoverLoad,
  subscribeToCoverSource,
} from "@/covers/coverSource";

const startWithEverySource = () => ALL_COVER_SOURCES;

/**
 * Resolves album artwork for display.
 *
 * A cover is tried through the app's image service first, then the third-party image proxy, then
 * at its own address, so it still shows when either fails; a source that has been failing for
 * everyone is skipped for new covers. A cover that has loaded keeps its image even if that
 * changes.
 *
 * @param imageSize When provided, requests a copy at this pixel size for tile displays.
 * @returns Image source state, whether a cover the album has could not be shown, a wrapper ref,
 *          and load/error handlers for the image element.
 */
export function useAlbumImage(album: Album, imageSize?: number) {
  const coverImage = album.cover_image;
  const sources = useSyncExternalStore(subscribeToCoverSource, coverSources, startWithEverySource);

  // Addresses to try, best first, with where each comes from.
  const candidates = useMemo(
    () => coverAddresses(coverImage ?? "", sources, imageSize != null ? { size: imageSize } : {}),
    [coverImage, imageSize, sources]
  );

  // What failed and what loaded are tied to the image being asked for, so a new album or size
  // starts clean by itself.
  const key = `${coverImage ?? ""}|${imageSize ?? ""}`;
  const [failed, setFailed] = useState<{ key: string; urls: string[] }>({ key: "", urls: [] });
  const [loaded, setLoaded] = useState<{ key: string; url: string } | null>(null);
  const imgRef = useRef<HTMLDivElement>(null);

  const failedHere = failed.key === key ? failed.urls : [];
  const keptUrl = loaded && loaded.key === key ? loaded.url : null;
  const next = candidates.find(({ src }) => !failedHere.includes(src));
  const sourceUrl = keptUrl ?? next?.src ?? "";
  const imageError = !sourceUrl;
  // A kept image may come from a source no longer in the list; reports about it change nothing.
  const kindOf = (url: string) => candidates.find(({ src }) => src === url)?.source ?? "direct";

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
