import { useState, useEffect, useRef } from "react";
import { Album } from "@/types";
import { getProxiedImageUrl, DEFAULT_PLACEHOLDER_IMAGE } from "@/utils/imageProxy";

/**
 * Resolves album artwork for display and prepares it for export-safe rendering when needed.
 *
 * @param album Album whose artwork should be displayed.
 * @param exportMode When true, converts the loaded image to a data URL for canvas export.
 * @returns Image source state, a wrapper ref, and load/error handlers for the image element.
 */
export function useAlbumImage(album: Album, exportMode: boolean = false) {
  const [imageError, setImageError] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>("");
  const imgRef = useRef<HTMLDivElement>(null);

  // Update image URL when album changes
  useEffect(() => {
    const coverImage = album.cover_image || album.coverUrl;
    if (coverImage) {
      const proxiedUrl = getProxiedImageUrl(coverImage);
      setImageUrl(proxiedUrl);
      setImageError(false);
    } else {
      setImageError(true);
    }
  }, [album]);

  /**
   * Falls back to the placeholder artwork when the album image cannot be loaded.
   */
  const handleImageError = () => {
    // Image load error - will use placeholder
    setImageError(true);
  };

  /**
   * Converts the loaded image into a data URL during export mode to reduce canvas CORS issues.
   */
  const handleImageLoad = () => {
    // Convert to data URL for export mode to avoid CORS issues
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
            setImageUrl(dataUrl);
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
    imgRef,
    handleImageError,
    handleImageLoad,
  };
}
