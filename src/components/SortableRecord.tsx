import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Album } from "../types/index";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { getProxiedImageUrl } from "../utils/imageProxy";

interface SortableRecordProps {
  album: Album;
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
    if (album.cover_image) {
      // Use the proxy service to avoid CORS issues
      const proxiedUrl = getProxiedImageUrl(album.cover_image);
      setImageUrl(proxiedUrl);
      setImageError(false);
    }
  }, [album.cover_image]);

  // For pinned albums, we don't apply any transform or transition
  // This ensures they visually stay completely fixed
  const style = isPinned
    ? {}
    : {
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
                className={`absolute top-2 right-2 w-6 h-6 rounded-full z-10 flex items-center justify-center bg-gray-800 bg-opacity-70 opacity-0 group-hover:opacity-100 transition-opacity ${isPinned ? "opacity-100 bg-blue-500" : ""}`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-4 h-4 text-white"
                >
                  {isPinned ? (
                    <path d="M20.2349 14.61C19.8599 12.865 20.4649 11.03 21.8149 9.675L21.8199 9.67C22.1237 9.3653 22.1242 8.8698 21.8199 8.565C21.5125 8.2569 21.5125 7.7431 21.8199 7.435L22.5699 6.685C22.8699 6.385 22.8699 5.915 22.5699 5.615L18.3849 1.43C18.0849 1.13 17.6149 1.13 17.3149 1.43L16.5649 2.18C16.2599 2.485 15.7449 2.485 15.4399 2.18C15.1338 1.873 14.6348 1.873 14.3299 2.18L14.3249 2.185C12.9749 3.535 11.1349 4.14 9.39488 3.765C7.25988 3.3 4.95488 4.01 3.35488 5.605L3.24988 5.71C3.05988 5.9 3.05988 6.2 3.24988 6.39L17.6149 20.75C17.8049 20.94 18.1049 20.94 18.2949 20.75L18.3999 20.645C19.9949 19.045 20.7049 16.745 20.2349 14.61Z" />
                  ) : (
                    <path d="M16 12V6c0-2.21-1.79-4-4-4S8 3.79 8 6v6h8zm-4 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
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
