import Image from "next/image";
import type { Album } from "@/types";
import { coverSources } from "@/utils/coverSource";
import { coverAddresses, DEFAULT_PLACEHOLDER_IMAGE } from "@/utils/imageProxy";
import { fitIntoFrame, type ExportBackdrop, type ExportPreset } from "@/utils/exportFrame";
import type { PosterSize } from "@/utils/posterLayout";
import { PosterPreview } from "./PosterPreview";

const PREVIEW_COVER_SIZE = 64;

/** What the preview shows: the wall by itself, a sized picture, or the hanging guide. */
export type ExportChoice = "wall" | ExportPreset["id"] | "poster" | "guide";

interface ExportPreviewProps {
  choice: ExportChoice;
  presets: readonly ExportPreset[];
  /** The albums on the wall, in order. */
  albums: Album[];
  rows: number;
  columns: number;
  /** What is behind the wall in a picture. */
  backdrop: ExportBackdrop;
  /** The poster's size, when a poster is chosen. */
  posterSize?: PosterSize;
}

// The record behind the wall, as the saved picture draws it: rings and two soft bands of light.
const RECORD_PREVIEW =
  "conic-gradient(from 0deg at 50% 50%, rgba(129,140,248,0) 0deg, rgba(129,140,248,0.1) 25deg, rgba(129,140,248,0) 55deg, rgba(129,140,248,0) 180deg, rgba(129,140,248,0.1) 205deg, rgba(129,140,248,0) 235deg), repeating-radial-gradient(circle at 50% 50%, transparent 0 3px, rgba(230,233,240,0.07) 3px 4px)";

// The guide is drawn on Letter or A4; the preview shows the shape they share.
const PAGE_ASPECT = 8.5 / 11;

function Tiles({ albums, columns }: { albums: Album[]; columns: number }) {
  return (
    <div
      className="grid h-full w-full gap-px"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {albums.map((album, at) => {
        const url = album.cover_image || album.coverUrl;
        const src = url
          ? coverAddresses(url, coverSources(), { size: PREVIEW_COVER_SIZE })[0]!.src
          : DEFAULT_PLACEHOLDER_IMAGE;
        return (
          <Image
            key={`${album.id}-${at}`}
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

/**
 * A small picture of what saving will make, drawn from the wall itself: the covers in their
 * places, in the shape and colour of the file.
 */
export function ExportPreview({
  choice,
  presets,
  albums,
  rows,
  columns,
  backdrop,
  posterSize = "18x24",
}: ExportPreviewProps) {
  const shown = albums.slice(0, rows * columns);
  // The wall's own shape, as the tiles lay out (square tiles, a hairline between).
  const wallAspect = columns / Math.max(1, rows);

  if (choice === "guide") {
    return (
      <div
        data-testid="export-preview"
        className="mx-auto h-48 rounded-[2px] border border-line bg-white p-3 @lg:h-72"
        style={{ aspectRatio: PAGE_ASPECT }}
      >
        <div className="mb-2 h-1.5 w-1/2 rounded-full bg-neutral-400" />
        <div className="mb-3" style={{ aspectRatio: wallAspect }}>
          <Tiles albums={shown} columns={columns} />
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {Array.from({ length: 12 }, (_, line) => (
            <div key={line} className="h-1 rounded-full bg-neutral-300" />
          ))}
        </div>
      </div>
    );
  }

  if (choice === "poster") {
    return (
      <PosterPreview
        albums={albums}
        rows={rows}
        columns={columns}
        size={posterSize}
        backdrop={backdrop}
      />
    );
  }

  const preset = presets.find((candidate) => candidate.id === choice);
  if (!preset) {
    // The wall by itself: its own shape, covers edge to edge.
    return (
      <div
        data-testid="export-preview"
        className="mx-auto h-40 max-w-full overflow-hidden rounded-[2px] @lg:h-56"
        style={{ aspectRatio: wallAspect, backgroundColor: backdrop.color }}
      >
        <Tiles albums={shown} columns={columns} />
      </div>
    );
  }

  const padding = Math.round(Math.min(preset.width, preset.height) * 0.05);
  const fit = fitIntoFrame(wallAspect * 1000, 1000, preset.width, preset.height, padding);
  return (
    <div
      data-testid="export-preview"
      className="relative mx-auto h-48 max-w-full overflow-hidden rounded-[2px] border border-line @lg:h-72"
      style={{
        aspectRatio: preset.width / preset.height,
        backgroundColor: backdrop.color,
        ...(backdrop.record ? { backgroundImage: RECORD_PREVIEW } : {}),
      }}
    >
      <div
        className="absolute"
        style={{
          left: `${(fit.x / preset.width) * 100}%`,
          top: `${(fit.y / preset.height) * 100}%`,
          width: `${(fit.width / preset.width) * 100}%`,
          height: `${(fit.height / preset.height) * 100}%`,
        }}
      >
        <Tiles albums={shown} columns={columns} />
      </div>
    </div>
  );
}
