import { useState } from "react";
import { wallSize } from "@/utils/wallSize";
import type { Album } from "@/types";

interface GridDimensionsConfigProps {
  isVisible: boolean;
  rows: number;
  columns: number;
  gridSize: number;
  defaultRows: number;
  defaultColumns: number;
  onDimensionsChange: (rows: number, columns: number) => void;
  onReset: () => void;
  /** "Show each album once": the setting, the sets of pressings, and the ones set aside. */
  pressings?: {
    once: boolean;
    groups: Album[][];
    hidden: Album[];
    setOnce: (once: boolean) => void;
  };
}

interface DimensionFieldProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}

/**
 * A number box that keeps exactly what the user types while it is focused, so it can be cleared
 * and retyped, and applies the value as soon as it is a whole number from min up. Anything above
 * max becomes max; leaving the box shows the real value again.
 */
function DimensionField({ id, label, value, min, max, onCommit }: DimensionFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <div className="flex w-full flex-col gap-2 sm:max-w-[180px]">
      <label htmlFor={id} className="text-sm text-ink">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={draft ?? String(value)}
        onChange={(event) => {
          const text = event.target.value;
          setDraft(text);
          const number = Number(text);
          if (text.trim() !== "" && Number.isInteger(number) && number >= min) {
            const next = Math.min(number, max);
            setDraft(String(next));
            onCommit(next);
          }
        }}
        onBlur={() => setDraft(null)}
        className="w-full rounded-control border border-line bg-panel px-3 py-2 text-ink"
      />
    </div>
  );
}

/**
 * Shows editable row and column inputs for the wall grid when the configuration panel is open.
 */
export function GridDimensionsConfig({
  isVisible,
  rows,
  columns,
  gridSize,
  defaultRows,
  defaultColumns,
  onDimensionsChange,
  onReset,
  pressings,
}: GridDimensionsConfigProps) {
  if (!isVisible) return null;

  return (
    <div className="mt-3 rounded-control bg-raised p-3">
      <h3 className="mb-3 text-ink font-medium">Wall Display Dimensions</h3>
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:gap-4">
        <DimensionField
          id="columns"
          label="Columns:"
          value={columns}
          min={1}
          max={12}
          onCommit={(next) => onDimensionsChange(rows, next)}
        />

        <DimensionField
          id="rows"
          label="Rows:"
          value={rows}
          min={1}
          max={10}
          onCommit={(next) => onDimensionsChange(next, columns)}
        />

        <p className="text-sm text-muted md:pb-2">
          Total albums in display: <span className="font-semibold">{gridSize}</span>
        </p>

        <div className="w-full md:ml-auto md:w-auto">
          <button
            onClick={onReset}
            className="w-full rounded-control bg-raised px-3 py-2 text-sm text-ink transition-colors hover:bg-line md:w-auto md:py-1"
          >
            Reset to default ({wallSize(defaultColumns, defaultRows)})
          </button>
        </div>
      </div>

      {pressings && (
        <div className="mt-3">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              role="switch"
              checked={pressings.once}
              onChange={(event) => pressings.setOnce(event.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            Show each album once (set aside extra pressings of the same album)
          </label>
          <p className="mt-1 text-xs text-muted">
            {pressings.groups.length === 0
              ? "No album appears more than once in this collection."
              : pressings.once
                ? `Setting aside ${pressings.hidden.length} extra ${
                    pressings.hidden.length === 1 ? "pressing" : "pressings"
                  }: ${pressings.hidden.map((album) => `${album.title} (${album.artist})`).join(", ")}.`
                : `${pressings.groups.length} ${
                    pressings.groups.length === 1 ? "album appears" : "albums appear"
                  } more than once: ${pressings.groups
                    .map((set) => `${set[0]!.title} (${set.length})`)
                    .join(", ")}. Matching is by artist and title, so check the list.`}
          </p>
        </div>
      )}

      <div className="mt-3 text-xs text-accent">
        <p>
          Note: Changing dimensions will redistribute albums between the wall display and the
          remaining records.
        </p>
      </div>
    </div>
  );
}
