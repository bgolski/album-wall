import { useState, useEffect, useRef } from "react";
import { Album } from "@/types";
import { getProxiedImageUrl, DEFAULT_PLACEHOLDER_IMAGE } from "@/utils/imageProxy";

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

  const handleImageError = () => {
    console.log(`Image load error for album ${album.id}: ${imageUrl}`);
    setImageError(true);
  };

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
