import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Album } from "../types/index";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { getProxiedImageUrl, DEFAULT_PLACEHOLDER_IMAGE } from "../utils/imageProxy";

// Extended album interface to include legacy coverUrl property
interface AlbumWithLegacyProps extends Album {
  coverUrl?: string;
}

interface SortableRecordProps {
  album: AlbumWithLegacyProps;
  exportMode?: boolean;
  isPinned?: boolean;
  onPinToggle?: (albumId: string) => void;
  disablePinning?: boolean;
}

export function SortableRecord({
  album,
  exportMode = false,
  isPinned = false,
  onPinToggle,
  disablePinning = false,
}: SortableRecordProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: `album-${album.id}`,
    disabled: isPinned, // Disable dragging if the album is pinned
  });
  const [imageError, setImageError] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>("");
  const imgRef = useRef<HTMLDivElement>(null);

  // Update image URL when album changes, using proxied URL to avoid CORS issues
  useEffect(() => {
    // Check for either cover_image or coverUrl (for backward compatibility)
    const coverImage = album.cover_image || album.coverUrl;
    if (coverImage) {
      // Use the proxy service to avoid CORS issues
      const proxiedUrl = getProxiedImageUrl(coverImage);
      setImageUrl(proxiedUrl);
      setImageError(false);
    } else {
      // No image available, set the error state to use placeholder
      setImageError(true);
    }
  }, [album]);

  // For pinned albums, we don't apply any transform or transition
  // This ensures they visually stay completely fixed
  const style = isPinned
    ? {}
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      };

  // Default placeholder image from our utility
  const placeholderImage = DEFAULT_PLACEHOLDER_IMAGE;

  // Handle image load error
  const handleImageError = () => {
    console.log(`Image load error for album ${album.id}: ${imageUrl}`);
    setImageError(true);
  };

  // Handle image load success
  const handleImageLoad = () => {
    // For export mode, convert to data URL once loaded to avoid CORS during export
    if (exportMode && imgRef.current) {
      try {
        // Find the actual img element inside our div
        const imgElement = imgRef.current.querySelector("img");
        if (!imgElement) return;

        const canvas = document.createElement("canvas");
        canvas.width = imgElement.naturalWidth || 300;
        canvas.height = imgElement.naturalHeight || 300;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(imgElement, 0, 0);
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

  // Handle click on album to toggle pin status
  const handleAlbumClick = (e: React.MouseEvent) => {
    // Don't toggle pin if pinning is disabled
    if (disablePinning || !onPinToggle) return;

    // Prevent event from bubbling to parent elements
    e.stopPropagation();

    // Toggle pin status
    onPinToggle(String(album.id));
  };

  return (
    <div
      ref={isPinned ? null : setNodeRef}
      style={style}
      {...(isPinned ? {} : attributes)}
      {...(isPinned ? {} : listeners)}
      className={`aspect-square ${isPinned ? "cursor-pointer" : "cursor-move"} group relative ${isPinned ? "z-10" : ""}`}
      data-album-id={album.id}
      data-pinned={isPinned ? "true" : "false"}
      onClick={handleAlbumClick}
    >
      <div className="relative w-full h-full">
        {exportMode ? (
          // During export, use an Image component that's unoptimized for better compatibility
          <div ref={imgRef} className="w-full h-full relative">
            <Image
              src={getImageSource()}
              alt={`${album.title || "Album"}`}
              fill
              sizes="(max-width: 768px) 100vw, 200px"
              className="object-cover rounded-lg shadow-lg"
              crossOrigin="anonymous"
              onLoad={handleImageLoad}
              onError={handleImageError}
              style={{ backgroundColor: "#333" }}
              unoptimized
            />
            {isPinned ? (
              <div className="absolute top-0 left-0 right-0 bottom-0 rounded-lg border-4 border-blue-400 pointer-events-none" />
            ) : (
              <div className="absolute top-0 left-0 right-0 bottom-0 rounded-lg border border-gray-600 pointer-events-none" />
            )}
          </div>
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
            {isPinned ? (
              <div className="absolute top-0 left-0 right-0 bottom-0 rounded-lg border-4 border-blue-400 pointer-events-none" />
            ) : (
              <div className="absolute top-0 left-0 right-0 bottom-0 rounded-lg border border-gray-600 pointer-events-none" />
            )}
            {!disablePinning && (
              <div
                className={`absolute top-2 right-2 w-6 h-6 rounded-full z-10 flex items-center justify-center bg-gray-800 bg-opacity-70 ${
                  isPinned
                    ? "opacity-0 group-hover:opacity-100 transition-opacity bg-blue-500"
                    : "opacity-0 group-hover:opacity-100 transition-opacity"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-4 h-4 text-white"
                >
                  {isPinned ? (
                    <path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z" />
                  ) : (
                    <path d="M17 3H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v6h2.03v-6H19v-2c-1.66 0-3-1.34-3-3V5h1c.55 0 1-.45 1-1s-.45-1-1-1zm-6 8.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                  )}
                </svg>
              </div>
            )}
          </div>
        )}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white p-2 rounded-b-lg album-labels ${isPinned ? "hidden" : ""}`}
        >
          <p className="text-xs font-bold truncate">{album.artist || "Unknown Artist"}</p>
          <p className="text-xs truncate">{album.title || "Untitled"}</p>
        </div>
      </div>
    </div>
  );
}
