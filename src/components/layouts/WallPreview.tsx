import Image from "next/image";
import type { Album, SharedWallState } from "@/types";
import { coverSources } from "@/covers/coverSource";
import { coverAddresses, DEFAULT_PLACEHOLDER_IMAGE } from "@/covers/imageProxy";

const PREVIEW_COVER_SIZE = 96;

/**
 * A small picture of a saved wall: its covers in their spots.
 *
 * @param props.name The saved wall's name, for the picture's description.
 */
export function WallPreview({
  name,
  wall,
  albumsById,
}: {
  name: string;
  wall: SharedWallState;
  albumsById: Map<string, Album>;
}) {
  return (
    <div
      role="img"
      aria-label={`${name}: ${wall.wallAlbumIds.length} albums`}
      className="mt-3 grid gap-px overflow-hidden rounded-control border border-line bg-line"
      style={{ gridTemplateColumns: `repeat(${wall.columns}, minmax(0, 1fr))` }}
    >
      {wall.wallAlbumIds.map((id, at) => {
        const album = albumsById.get(id);
        const url = album?.cover_image;
        const src = url
          ? coverAddresses(url, coverSources(), { size: PREVIEW_COVER_SIZE })[0]!.src
          : DEFAULT_PLACEHOLDER_IMAGE;
        return (
          <Image
            key={`${id}-${at}`}
            src={src}
            alt=""
            width={PREVIEW_COVER_SIZE}
            height={PREVIEW_COVER_SIZE}
            unoptimized
            loading="lazy"
            className="aspect-square h-auto w-full object-cover"
          />
        );
      })}
    </div>
  );
}
