import Image from "next/image";
import { Album } from "@/types";
import { useAlbumImage } from "@/hooks/useAlbumImage";
import { TILE_COVER_SIZE } from "@/covers/imageProxy";

interface AlbumDragPreviewProps {
  album: Album;
}

/**
 * Renders the cover of the album being dragged inside the drag overlay, at the size the tiles use
 * so it is already loaded and never shows as a grey square.
 */
export function AlbumDragPreview({ album }: AlbumDragPreviewProps) {
  const { imageSource, handleImageError } = useAlbumImage(album, TILE_COVER_SIZE);

  return (
    <div className="relative aspect-square w-full h-full cursor-grabbing">
      <Image
        src={imageSource}
        alt={album.title || "Album"}
        fill
        sizes="200px"
        className="object-cover rounded-tile shadow-2xl ring-2 ring-white/60"
        onError={handleImageError}
        style={{ backgroundColor: "#333" }}
        unoptimized
      />
    </div>
  );
}
