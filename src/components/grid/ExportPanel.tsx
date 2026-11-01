import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Album } from "@/types";
import {
  EXPORT_BACKDROPS,
  EXPORT_PRESETS,
  type ExportBackdrop,
  type ExportBackground,
  type ExportPreset,
} from "@/export/exportFrame";
import { POSTER_SIZES, type PosterSize } from "@/export/posterService";
import { ExportPreview, type ExportChoice } from "./ExportPreview";

interface ExportPanelProps {
  isVisible: boolean;
  /** The albums on the wall, in order, and the wall's shape. */
  albums: Album[];
  rows: number;
  columns: number;
  isExporting: boolean;
  /** Saves a picture: the wall alone (no preset) or in a preset's size, on a backdrop. */
  onSaveImage: (preset: ExportPreset | undefined, backdrop: ExportBackdrop) => void;
  /** How many steps change the wall hung last time into this one; none when there is no such wall. */
  stepCount?: number;
  /** Makes the guide, with the steps to change the wall hung last time when asked. */
  onSaveGuide: (withSteps: boolean) => void;
  /** Has a poster drawn at print size, in the chosen size, on the chosen background. */
  onSavePoster: (size: PosterSize, background: ExportBackground) => void;
}

const outline = "block border-[1.5px] border-current rounded-[3px]";

// A small shape for each choice, so the four can be told apart without words.
const SHAPES: Record<ExportChoice, ReactNode> = {
  wall: <span className={`${outline} h-4 w-8`} />,
  phone: <span className={`${outline} h-8 w-[18px]`} />,
  desktop: <span className={`${outline} h-5 w-8`} />,
  poster: <span className={`${outline} h-8 w-6`} />,
  guide: (
    <span className={`${outline} flex h-8 w-6 flex-col justify-end gap-[3px] p-[3px]`}>
      <span className="block h-[3px] rounded-full bg-current" />
      <span className="block h-[3px] rounded-full bg-current" />
    </span>
  ),
};

const CHOICES: { id: ExportChoice; label: string; title: string }[] = [
  { id: "wall", label: "Wall", title: "The wall as it is" },
  ...EXPORT_PRESETS.map((preset) => ({
    id: preset.id as ExportChoice,
    label: preset.label,
    title: `${preset.width} × ${preset.height}`,
  })),
  { id: "poster", label: "Poster", title: "Print size, made online" },
  { id: "guide", label: "Guide", title: "PDF to hang the wall by" },
];

const chip = (selected: boolean) =>
  `rounded-control px-3 py-1.5 text-sm font-medium text-ink transition-colors ${
    selected ? "bg-line ring-2 ring-inset ring-accent" : "bg-raised hover:bg-line"
  }`;

/**
 * Saves the wall: pick what to make (the wall alone, a phone or desktop wallpaper, a print, or a
 * PDF guide to hang it by), see it, and save it. Pictures can be dark or light behind the wall.
 */
export function ExportPanel({
  isVisible,
  albums,
  rows,
  columns,
  isExporting,
  onSaveImage,
  stepCount = 0,
  onSaveGuide,
  onSavePoster,
}: ExportPanelProps) {
  const [choice, setChoice] = useState<ExportChoice>("phone");
  const [background, setBackground] = useState<ExportBackground>("dark");
  const [posterSize, setPosterSize] = useState<PosterSize>("18x24");
  const [withSteps, setWithSteps] = useState(true);
  const chosenBackground = useRef(false);

  // Until a background is picked here, the picture follows the page's light or dark mode.
  useEffect(() => {
    if (!isVisible || chosenBackground.current) return;
    setBackground(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, [isVisible]);

  // The record needs a frame to fill, so the wall by itself has only the two plain colours.
  const shown: ExportBackground =
    choice === "wall" && background === "record" ? "dark" : background;
  const backdrop = EXPORT_BACKDROPS[shown];
  const save = () => {
    if (choice === "guide") onSaveGuide(stepCount > 0 && withSteps);
    else if (choice === "poster") onSavePoster(posterSize, shown);
    else
      onSaveImage(
        EXPORT_PRESETS.find((preset) => preset.id === choice),
        backdrop
      );
  };

  return (
    <section hidden={!isVisible} aria-labelledby="export-heading" className="pr-8">
      <h3 id="export-heading" className="mb-3 font-medium text-ink">
        Export
      </h3>

      <div role="group" aria-label="Export as" className="mb-4 grid grid-cols-5 gap-1.5">
        {CHOICES.map(({ id, label, title }) => (
          <button
            key={id}
            type="button"
            title={title}
            aria-pressed={choice === id}
            onClick={() => setChoice(id)}
            className={`flex flex-col items-center justify-end gap-1.5 rounded-control px-1 py-2 text-[13px] font-medium text-ink transition-colors ${
              choice === id ? "bg-line ring-2 ring-inset ring-accent" : "bg-raised hover:bg-line"
            }`}
          >
            <span className="flex h-8 items-end">{SHAPES[id]}</span>
            {label}
          </button>
        ))}
      </div>

      {isVisible && (
        <div className="mb-4" role="img" aria-label="Preview">
          <ExportPreview
            choice={choice}
            presets={EXPORT_PRESETS}
            albums={albums}
            rows={rows}
            columns={columns}
            backdrop={backdrop}
            posterSize={posterSize}
          />
        </div>
      )}

      {choice === "poster" && (
        <div role="group" aria-label="Poster size" className="mb-3 flex gap-1.5">
          {POSTER_SIZES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={posterSize === id}
              title={`${label} inches`}
              onClick={() => setPosterSize(id)}
              className={chip(posterSize === id)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        {choice === "guide" ? (
          stepCount > 0 ? (
            <button
              type="button"
              aria-pressed={withSteps}
              title="Steps to change the wall you hung last time into this one"
              onClick={() => setWithSteps(!withSteps)}
              className={chip(withSteps)}
            >
              Steps
            </button>
          ) : (
            <span />
          )
        ) : (
          <div role="group" aria-label="Background" className="flex gap-1.5">
            {(choice === "wall"
              ? (["dark", "light"] as const)
              : (["dark", "light", "record"] as const)
            ).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={shown === option}
                onClick={() => {
                  chosenBackground.current = true;
                  setBackground(option);
                }}
                className={chip(shown === option)}
              >
                {option === "dark" ? "Dark" : option === "light" ? "Light" : "Record"}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={save}
          disabled={isExporting}
          className="rounded-control bg-accent px-6 py-2 text-sm font-medium text-on-accent hover:bg-accent-hover disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </section>
  );
}
