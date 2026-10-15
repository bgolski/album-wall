import { useEffect, useId, useMemo, useRef, useState } from "react";
import { oklabToHex } from "@/utils/gradientTargets";
import { InfoTip } from "@/components/ui/InfoTip";
import { wallSize } from "@/utils/wallSize";
import { wallTargets, type WallGradient } from "./buildGradientWall";
import type { SuggestedGradient } from "./suggestGradients";

/** What a build did, for the status line. */
export interface GradientBuildSummary {
  match: "close" | "fair" | "loose";
  unmeasured: number;
  artistConflicts: number;
  keepArtistsApart: boolean;
  coversOfColor: number | null;
}

interface GradientPanelProps {
  isVisible: boolean;
  rows: number;
  columns: number;
  /** Covers still being measured, or 0 once every cover has a color (or none could be read). */
  pending: number;
  /** Covers in the collection, for the measuring progress. */
  total: number;
  onBuild: (
    gradient: WallGradient,
    keepArtistsApart: boolean,
    preferRested: boolean
  ) => GradientBuildSummary | Promise<GradientBuildSummary>;
  /** Whether there is wall history, so records not hung recently can be preferred. */
  canPreferRested?: boolean;
  /** Colors to start from instead of the first preset, and a note saying where they came from. */
  start?: { colors: string[]; note: string } | undefined;
  /** Gradients this collection can fill well, once its colors are read. */
  suggestions?: SuggestedGradient[];
  /** One sentence about the collection's colors. */
  summary?: string;
  /** Shows a short message that goes away on its own; without it the message stays in the panel. */
  onNotice?: (message: string) => void;
}

const PRESETS: { name: string; colors: string[] }[] = [
  { name: "Rainbow", colors: ["#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#8e24aa"] },
  { name: "Sunset", colors: ["#2b1055", "#d53369", "#fbb03b"] },
  { name: "Ocean", colors: ["#0b132b", "#1c7293", "#9ad1d4"] },
  { name: "Forest", colors: ["#1b4332", "#52b788", "#d8f3dc"] },
  { name: "Fire", colors: ["#3d0c02", "#d00000", "#ffba08"] },
  { name: "Black to white", colors: ["#111111", "#f5f5f5"] },
];

const SINGLE_COLORS: { name: string; hex: string }[] = [
  { name: "Red", hex: "#d32f2f" },
  { name: "Orange", hex: "#f57c00" },
  { name: "Yellow", hex: "#fbc02d" },
  { name: "Green", hex: "#388e3c" },
  { name: "Blue", hex: "#1976d2" },
  { name: "Purple", hex: "#7b1fa2" },
  { name: "Pink", hex: "#e91e63" },
  { name: "Black", hex: "#111111" },
  { name: "White", hex: "#f5f5f5" },
];

// Compass order, row by row; the middle cell is empty. Angles follow CSS: 0 points up.
const COMPASS: ({ label: string; arrow: string; angle: number } | null)[] = [
  { label: "Toward top left", arrow: "↖", angle: 315 },
  { label: "Bottom to top", arrow: "↑", angle: 0 },
  { label: "Toward top right", arrow: "↗", angle: 45 },
  { label: "Right to left", arrow: "←", angle: 270 },
  null,
  { label: "Left to right", arrow: "→", angle: 90 },
  { label: "Toward bottom left", arrow: "↙", angle: 225 },
  { label: "Top to bottom", arrow: "↓", angle: 180 },
  { label: "Toward bottom right", arrow: "↘", angle: 135 },
];

const HEX = /^#[0-9a-f]{6}$/i;
const MAX_EDITED_COLORS = 3;

const chipClass =
  "rounded-control px-3 py-1.5 text-sm font-medium transition-colors bg-panel text-ink hover:bg-line";

/**
 * Describes a build in plain words, naming the reason when the match is loose.
 *
 * @param summary What the build did.
 * @returns One or two sentences for the status line.
 */
export function describeBuild(summary: GradientBuildSummary): string {
  const parts = ["Wall built"];
  if (summary.match === "loose") {
    parts.push(
      summary.coversOfColor === null
        ? "loosely: few covers in these colors"
        : summary.coversOfColor === 0
          ? "loosely: no covers near this color"
          : `loosely: only ${summary.coversOfColor} ${summary.coversOfColor === 1 ? "cover" : "covers"} near this color`
    );
  }
  if (summary.unmeasured > 0) {
    parts.push(
      `${summary.unmeasured} ${summary.unmeasured === 1 ? "cover" : "covers"} without a readable color`
    );
  }
  if (summary.keepArtistsApart && summary.artistConflicts > 0) {
    parts.push(
      `${summary.artistConflicts} same-artist ${summary.artistConflicts === 1 ? "pair" : "pairs"} still touch`
    );
  }
  return parts.length === 1 ? "Wall built" : `${parts[0]}, ${parts.slice(1).join("; ")}`;
}

/**
 * The gradient builder behind Sort by Color: start from a preset or a color, adjust two or three
 * colors and a direction while a wall-shaped preview shows what each spot aims for, then fill the
 * wall with the covers that best fit it.
 */
export function GradientPanel({
  isVisible,
  rows,
  columns,
  pending,
  total,
  onBuild,
  suggestions = [],
  summary = "",
  canPreferRested = false,
  start,
  onNotice,
}: GradientPanelProps) {
  const id = useId();
  const [colors, setColors] = useState<string[]>(start?.colors ?? PRESETS[0]!.colors);
  const [selected, setSelected] = useState<number | null>(null);
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const [angle, setAngle] = useState(90);
  const [keepApart, setKeepApart] = useState(false);
  const [preferRested, setPreferRested] = useState(false);
  const [building, setBuilding] = useState(false);
  const [message, setMessage] = useState<string | null>(start?.note ?? null);
  const sectionRef = useRef<HTMLElement>(null);

  // Started from a cover's color while scrolled down the wall: bring the builder into view.
  useEffect(() => {
    if (start) sectionRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [start]);

  const targets = useMemo(
    () => wallTargets({ colors, angle }, rows, columns).map(oklabToHex),
    [colors, angle, rows, columns]
  );

  if (!isVisible) return null;

  const startFrom = (next: string[]) => {
    setColors(next);
    setSelected(null);
    setHexDraft(null);
  };
  const select = (index: number | null) => {
    setSelected(index);
    setHexDraft(null);
  };
  const setSelectedColor = (hex: string) =>
    setColors((current) =>
      current.map((color, at) => (at === selected ? hex.toLowerCase() : color))
    );
  const measuring = pending > 0;
  const editing = selected !== null && selected < colors.length ? selected : null;
  const shownHex = hexDraft ?? (editing !== null ? colors[editing]! : "");

  const handleBuild = async () => {
    setBuilding(true);
    try {
      const built = await onBuild({ colors, angle }, keepApart, canPreferRested && preferRested);
      const result = describeBuild({ ...built, keepArtistsApart: keepApart });
      if (onNotice) {
        setMessage(null);
        onNotice(result);
      } else {
        setMessage(result);
      }
    } finally {
      setBuilding(false);
    }
  };

  return (
    <section ref={sectionRef} aria-labelledby={`${id}-heading`} className="pr-8">
      <h3 id={`${id}-heading`} className="mb-3 font-medium text-ink">
        Sort by Color
      </h3>

      {suggestions.length > 0 && (
        <div className="mb-4">
          <p id={`${id}-suggested`} className="text-sm text-muted">
            Suggested for your collection
          </p>
          {summary && <p className="mb-1 text-xs text-muted">{summary}</p>}
          <div role="group" aria-labelledby={`${id}-suggested`} className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => {
              const label = suggestion.names
                .map((name, index) => (index === 0 ? name[0]!.toUpperCase() + name.slice(1) : name))
                .join(" → ");
              return (
                <button
                  key={suggestion.colors.join()}
                  type="button"
                  className={`${chipClass} flex items-center gap-2`}
                  onClick={() => startFrom(suggestion.colors)}
                >
                  <span
                    aria-hidden="true"
                    className="inline-block h-3 w-6 rounded-sm"
                    style={{
                      backgroundImage: `linear-gradient(90deg, ${suggestion.colors.join(", ")})`,
                    }}
                  />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-4">
        <p id={`${id}-start`} className="mb-1 text-sm text-muted">
          Start from
        </p>
        <div
          role="group"
          aria-labelledby={`${id}-start`}
          className="flex flex-wrap items-center gap-2"
        >
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className={`${chipClass} flex items-center gap-2`}
              onClick={() => startFrom(preset.colors)}
            >
              <span
                aria-hidden="true"
                className="inline-block h-3 w-6 rounded-sm"
                style={{ backgroundImage: `linear-gradient(90deg, ${preset.colors.join(", ")})` }}
              />
              {preset.name}
            </button>
          ))}
          {SINGLE_COLORS.map((single) => (
            <button
              key={single.name}
              type="button"
              aria-label={`All ${single.name.toLowerCase()}`}
              title={`All ${single.name.toLowerCase()}`}
              className="h-7 w-7 rounded-full border border-line"
              style={{ backgroundColor: single.hex }}
              onClick={() => startFrom([single.hex, single.hex])}
            />
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-4 @lg:flex-row @lg:items-start @lg:justify-between">
        <div className="flex flex-col gap-4">
          <div>
            <p id={`${id}-colors`} className="mb-1 text-sm text-muted">
              Colors
            </p>
            <div
              role="group"
              aria-labelledby={`${id}-colors`}
              className="flex flex-wrap items-center gap-2"
            >
              {colors.map((color, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`Color ${index + 1}, ${color}`}
                  aria-pressed={editing === index}
                  className={`h-9 w-9 rounded-control border-2 ${
                    editing === index ? "border-accent" : "border-line"
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => select(editing === index ? null : index)}
                />
              ))}
              {colors.length < MAX_EDITED_COLORS && (
                <button
                  type="button"
                  aria-label="Add a color"
                  title="Add a color"
                  className={`${chipClass} h-9 w-9 px-0`}
                  onClick={() => {
                    setColors([...colors, colors[colors.length - 1]!]);
                    select(colors.length);
                  }}
                >
                  +
                </button>
              )}
            </div>
            {editing !== null && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="color"
                  aria-label={`Pick color ${editing + 1}`}
                  value={colors[editing]}
                  onChange={(event) => {
                    setSelectedColor(event.target.value);
                    setHexDraft(null);
                  }}
                  className="h-9 w-11 cursor-pointer rounded-control border border-line bg-panel"
                />
                <input
                  aria-label={`Color ${editing + 1}, hex code`}
                  value={shownHex}
                  maxLength={7}
                  aria-invalid={!HEX.test(shownHex)}
                  onChange={(event) => {
                    const value = event.target.value.trim();
                    setHexDraft(value);
                    if (HEX.test(value)) setSelectedColor(value);
                  }}
                  className="w-24 rounded-control border border-line bg-panel px-2 py-1.5 font-mono text-sm text-ink aria-[invalid=true]:border-danger"
                />
                {colors.length > 2 && (
                  <button
                    type="button"
                    className={chipClass}
                    onClick={() => startFrom(colors.filter((_, at) => at !== editing))}
                  >
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <p id={`${id}-direction`} className="mb-1 text-sm text-muted">
              Direction
            </p>
            <div
              role="group"
              aria-labelledby={`${id}-direction`}
              className="grid w-max grid-cols-3 gap-1"
            >
              {COMPASS.map((direction, index) =>
                direction ? (
                  <button
                    key={direction.angle}
                    type="button"
                    aria-label={direction.label}
                    aria-pressed={angle === direction.angle}
                    title={direction.label}
                    className={`h-9 w-9 rounded-control text-base transition-colors ${
                      angle === direction.angle
                        ? "bg-accent text-on-accent"
                        : "bg-panel text-ink hover:bg-line"
                    }`}
                    onClick={() => setAngle(direction.angle)}
                  >
                    {direction.arrow}
                  </button>
                ) : (
                  <span key={`middle-${index}`} aria-hidden="true" />
                )
              )}
            </div>
          </div>
        </div>

        <figure className="w-full max-w-56 @lg:w-72 @lg:max-w-none">
          <div
            aria-hidden="true"
            className="grid gap-px overflow-hidden rounded-control border border-line"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {targets.map((hex, index) => (
              <span key={index} className="aspect-square" style={{ backgroundColor: hex }} />
            ))}
          </div>
          <figcaption className="mt-1 text-xs text-muted">
            What each spot on your {wallSize(columns, rows)} wall aims for
          </figcaption>
        </figure>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <span className="flex items-center gap-1">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              role="switch"
              checked={keepApart}
              onChange={(event) => setKeepApart(event.target.checked)}
              aria-describedby={`${id}-apart-tip`}
              className="h-4 w-4 accent-accent"
            />
            Space out artists
          </label>
          <InfoTip
            id={`${id}-apart-tip`}
            label="Space out artists"
            text="Keeps the same artist's covers apart."
          />
        </span>
        {canPreferRested && (
          <span className="flex items-center gap-1">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                role="switch"
                checked={preferRested}
                onChange={(event) => setPreferRested(event.target.checked)}
                aria-describedby={`${id}-rested-tip`}
                className="h-4 w-4 accent-accent"
              />
              Avoid recent walls
            </label>
            <InfoTip
              id={`${id}-rested-tip`}
              label="Avoid recent walls"
              text="Favors records you haven't hung lately."
            />
          </span>
        )}
      </div>
      <button
        type="button"
        disabled={measuring || building}
        onClick={() => void handleBuild()}
        className="mt-4 w-full rounded-control bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        Build wall
      </button>
      <p role="status" className="mt-2 text-sm text-muted">
        {measuring
          ? `Reading cover colors... ${total - pending} of ${total}`
          : building
            ? "Building the wall..."
            : (message ?? "")}
      </p>
    </section>
  );
}
