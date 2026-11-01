import { useEffect, useRef } from "react";
import Image from "next/image";
import type { Album } from "@/types";
import { coverSources } from "@/covers/coverSource";
import { coverAddresses, DEFAULT_PLACEHOLDER_IMAGE } from "@/covers/imageProxy";
import type { ExportBackdrop } from "@/export/exportFrame";
import { drawRecordBackground } from "@/export/recordBackground";
import { POSTER_RADIUS, posterLayout, type PosterSize } from "@/export/posterLayout";

const COVER_SIZE = 64;
// The background is drawn at this many pixels across the poster's short side.
const BACKGROUND_SIDE = 480;

interface PosterPreviewProps {
  albums: Album[];
  rows: number;
  columns: number;
  size: PosterSize;
  backdrop: ExportBackdrop;
}

/**
 * The poster in miniature, laid out by the same code the poster service uses (same margin, gaps,
 * rounded corners and turning for a wide wall), so what is shown is what is made: the covers on a
 * plain colour or on the record.
 */
export function PosterPreview({ albums, rows, columns, size, backdrop }: PosterPreviewProps) {
  const layout = posterLayout(size, rows, columns);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sideways = layout.width > layout.height;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const scale = BACKGROUND_SIDE / Math.min(layout.width, layout.height);
    canvas.width = Math.round(layout.width * scale);
    canvas.height = Math.round(layout.height * scale);
    context.fillStyle = backdrop.color;
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (backdrop.record) drawRecordBackground(context, canvas.width, canvas.height);
  }, [layout.width, layout.height, backdrop.color, backdrop.record]);

  const percent = (value: number, of: number) => `${(value / of) * 100}%`;
  return (
    <div
      data-testid="export-preview"
      className={`relative mx-auto overflow-hidden rounded-[2px] border border-line ${
        sideways ? "w-full" : "h-64"
      }`}
      style={{ aspectRatio: `${layout.width} / ${layout.height}`, backgroundColor: backdrop.color }}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />
      {albums.slice(0, rows * columns).map((album, index) => {
        const url = album.cover_image;
        const src = url
          ? coverAddresses(url, coverSources(), { size: COVER_SIZE })[0]!.src
          : DEFAULT_PLACEHOLDER_IMAGE;
        const row = Math.floor(index / columns);
        const column = index % columns;
        return (
          <Image
            key={`${album.id}-${index}`}
            src={src}
            alt=""
            width={COVER_SIZE}
            height={COVER_SIZE}
            unoptimized
            loading="lazy"
            data-testid="poster-cover"
            className="absolute object-cover"
            style={{
              left: percent(layout.left + column * (layout.tile + layout.gap), layout.width),
              top: percent(layout.top + row * (layout.tile + layout.gap), layout.height),
              width: percent(layout.tile, layout.width),
              height: percent(layout.tile, layout.height),
              borderRadius: `${Math.round(POSTER_RADIUS * 1000) / 10}%`,
            }}
          />
        );
      })}
    </div>
  );
}
