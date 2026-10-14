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
 * Resolves album artwork for display and prepares it for export-safe rendering when needed.
 *
 * A cover is tried through the image proxy first and then at its own address, so it still shows
 * when the proxy fails; when the proxy has been failing for everyone, new covers go straight to
 * their own address. A cover that has loaded keeps its image even if that changes.
 *
 * @param album Album whose artwork should be displayed.
 * @param exportMode When true, converts the loaded image to a data URL for canvas export.
 * @param imageSize When provided and exportMode is false, requests a proxied URL at this
 *                   pixel size for larger tile displays.
 * @returns Image source state, whether a cover the album has could not be shown, a wrapper ref,
 *          and load/error handlers for the image element.
 */
export function useAlbumImage(album: Album, exportMode: boolean = false, imageSize?: number) {
  const coverImage = album.cover_image || album.coverUrl;
  const source = useSyncExternalStore(subscribeToCoverSource, coverSource, startOnProxy);

  // Memoize by cover URL, requested size, and export mode.
  const proxiedUrl = useMemo(() => {
    if (!coverImage) return "";
    if (imageSize != null && !exportMode) {
      return getProxiedImageUrl(coverImage, { size: imageSize });
    }
    return getProxiedImageUrl(coverImage);
  }, [coverImage, imageSize, exportMode]);

  // Addresses to try, best first.
  const candidates = useMemo(() => {
    if (!coverImage) return [];
    return source === "proxy" ? [proxiedUrl, coverImage] : [coverImage];
  }, [coverImage, proxiedUrl, source]);

  // What failed and what loaded are tied to the image being asked for, so a new album, size or
  // export starts clean by itself.
  const key = `${coverImage ?? ""}|${exportMode}|${imageSize ?? ""}`;
  const [failed, setFailed] = useState<{ key: string; urls: string[] }>({ key: "", urls: [] });
  const [loaded, setLoaded] = useState<{ key: string; url: string } | null>(null);
  const [exported, setExported] = useState<{ source: string; dataUrl: string } | null>(null);
  const imgRef = useRef<HTMLDivElement>(null);

  const failedHere = failed.key === key ? failed.urls : [];
  const keptUrl = loaded && loaded.key === key ? loaded.url : null;
  const sourceUrl = keptUrl ?? candidates.find((url) => !failedHere.includes(url)) ?? "";
  const imageError = !sourceUrl;
  const imageUrl =
    exportMode && exported && exported.source === sourceUrl ? exported.dataUrl : sourceUrl;
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
   * Notes that the cover loaded, and during export converts it to a data URL to avoid canvas
   * CORS issues.
   */
  const handleImageLoad = () => {
    if (!sourceUrl) return;
    // Saving an image can briefly put the placeholder in place of a cover the page may not read;
    // that load (like the load of a converted copy) is not the cover itself.
    const shown = imgRef.current?.querySelector("img")?.getAttribute("src");
    if (shown != null && shown !== sourceUrl) return;
    if (!keptUrl) {
      reportCoverLoad(kindOf(sourceUrl), true);
      setLoaded({ key, url: sourceUrl });
    }
    if (exportMode && imgRef.current) {
      try {
        const imgElement = imgRef.current.querySelector("img");
        if (!imgElement) return;

        const canvas = document.createElement("canvas");
        canvas.width = imgElement.naturalWidth || 300;
        canvas.height = imgElement.naturalHeight || 300;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          ctx.drawImage(imgElement, 0, 0);
          const dataUrl = canvas.toDataURL("image/png");
          if (dataUrl && dataUrl !== "data:,") {
            setExported({ source: sourceUrl, dataUrl });
          }
        }
      } catch (e) {
        console.error("Error converting image to data URL:", e);
      }
    }
  };

  const imageSource = imageError || !imageUrl ? DEFAULT_PLACEHOLDER_IMAGE : imageUrl;

  return {
    imageSource,
    imageError,
    /** The album has a cover, but it could not be shown (the placeholder is showing instead). */
    coverMissing: Boolean(coverImage) && imageError,
    imgRef,
    handleImageError,
    handleImageLoad,
  };
}
