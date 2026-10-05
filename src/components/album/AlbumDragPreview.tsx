import Image from "next/image";
import { Album } from "@/types";
import { useAlbumImage } from "@/hooks/useAlbumImage";

interface AlbumDragPreviewProps {
  album: Album;
}

/**
 * Renders the cover of the album being dragged inside the drag overlay.
 */
export function AlbumDragPreview({ album }: AlbumDragPreviewProps) {
  const { imageSource, handleImageError } = useAlbumImage(album);

  return (
    <div className="relative aspect-square w-full h-full cursor-grabbing">
      <Image
        src={imageSource}
        alt={album.title || "Album"}
        fill
        sizes="200px"
        className="object-cover rounded-lg shadow-2xl ring-2 ring-white/60"
        onError={handleImageError}
        style={{ backgroundColor: "#333" }}
        unoptimized
      />
    </div>
  );
}
