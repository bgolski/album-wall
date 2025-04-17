import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Album } from "../types/index";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { getProxiedImageUrl } from "../utils/imageProxy";

interface SortableRecordProps {
  album: Album;
  exportMode?: boolean;
}

export function SortableRecord({ album, exportMode = false }: SortableRecordProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: album.id,
  });
  const [imageError, setImageError] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imgLoaded, setImgLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Update image URL when album changes, using proxied URL to avoid CORS issues
  useEffect(() => {
    if (album.cover_image) {
      // Use the proxy service to avoid CORS issues
      const proxiedUrl = getProxiedImageUrl(album.cover_image);
      setImageUrl(proxiedUrl);
      setImageError(false);
      setImgLoaded(false);
    }
  }, [album.cover_image]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Default placeholder image - embedded SVG with darker background for better visibility
  const placeholderImage =
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iIzIyMiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNhYWEiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiPkFsYnVtIEFydHdvcms8L3RleHQ+PC9zdmc+";

  // Handle image load error
  const handleImageError = () => {
    console.log(`Image load error for album ${album.id}: ${imageUrl}`);
    setImageError(true);
  };

  // Handle image load success
  const handleImageLoad = () => {
    setImgLoaded(true);

    // For export mode, convert to data URL once loaded to avoid CORS during export
    if (exportMode && imgRef.current) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = imgRef.current.naturalWidth || 300;
        canvas.height = imgRef.current.naturalHeight || 300;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(imgRef.current, 0, 0);
          // Replace with data URL
          const dataUrl = canvas.toDataURL("image/png");
          if (dataUrl && dataUrl !== "data:,") {
            setImageUrl(dataUrl);
          }
        }
      } catch (e) {
        console.error("Error converting image to data URL:", e);
        // Continue with original URL
      }
    }
  };

  // Choose the right image source
  const getImageSource = () => {
    if (imageError || !imageUrl) {
      return placeholderImage;
    }
    return imageUrl;
  };

  // Log album data for debugging
  useEffect(() => {
    if (exportMode) {
      console.log("Album in export mode:", {
        id: album.id,
        title: album.title,
        cover_image: album.cover_image,
        hasImage: !!album.cover_image,
        currentImageUrl: imageUrl,
        hasError: imageError,
      });
    }
  }, [exportMode, album, imageUrl, imageError]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="aspect-square cursor-move group relative"
      data-album-id={album.id}
    >
      <div className="relative w-full h-full">
        {exportMode ? (
          // During export, use regular img tag for better html2canvas compatibility
          <img
            ref={imgRef}
            src={getImageSource()}
            alt={`${album.title || "Album"}`}
            className="w-full h-full object-cover rounded-lg shadow-lg"
            crossOrigin="anonymous"
            onLoad={handleImageLoad}
            onError={handleImageError}
            style={{ backgroundColor: "#333" }}
          />
        ) : (
          // Normal mode: use Next.js Image component
          <div className="w-full h-full relative">
            <Image
              key={`${album.id}-${imageUrl}-${imageError ? "error" : "ok"}`}
              src={getImageSource()}
              alt={`${album.title || "Album"}`}
              fill
              sizes="(max-width: 768px) 100vw, 200px"
              className="object-cover rounded-lg shadow-lg"
              onError={handleImageError}
              onLoad={handleImageLoad}
              unoptimized
            />
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white p-2 rounded-b-lg album-labels">
          <p className="text-xs font-bold truncate">{album.artist || "Unknown Artist"}</p>
          <p className="text-xs truncate">{album.title || "Untitled"}</p>
        </div>
      </div>
    </div>
  );
}
