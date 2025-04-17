import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Album } from "@/types";
import { useState, useEffect } from "react";

interface SortableRecordProps {
  album: Album;
}

export function SortableRecord({ album }: SortableRecordProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: album.id });
  const [imageError, setImageError] = useState(false);
  const [imageUrl, setImageUrl] = useState(album.cover_image || "");

  // Update image URL when album changes
  useEffect(() => {
    if (album.cover_image && album.cover_image !== imageUrl) {
      setImageUrl(album.cover_image);
      setImageError(false);
    }
  }, [album.cover_image, imageUrl]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Default placeholder image - embedded SVG
  const placeholderImage =
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgZmlsbD0iIzMzMyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNmZmYiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==";

  // Handle image load error
  const handleImageError = () => {
    console.log(`Image load error for album ${album.id}: ${imageUrl}`);
    setImageError(true);
  };

  // Choose the right image source
  const getImageSource = () => {
    if (imageError) {
      return placeholderImage;
    }

    if (!imageUrl) {
      return placeholderImage;
    }

    return imageUrl;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="aspect-square cursor-move group relative"
    >
      <div className="relative w-full h-full">
        <img
          // Using key for forced re-rendering when source changes
          key={`${album.id}-${imageUrl}-${imageError ? "error" : "ok"}`}
          src={getImageSource()}
          alt={`${album.title || "Album"}`}
          className="w-full h-full object-cover rounded-lg shadow-lg"
          onError={handleImageError}
        />
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white p-2 rounded-b-lg album-labels">
          {/* <p className="text-sm font-bold truncate">
            {album.artist || "Unknown Artist"}
          </p> */}
          <p className="text-xs font-bold truncate">
            {album.artist || "Unknown Artist"}
          </p>
          <p className="text-xs truncate">{album.title || "Untitled"}</p>
        </div>
      </div>
    </div>
  );
}
