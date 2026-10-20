import { useState } from "react";
import type { Album } from "@/types";
import { InfoTip } from "@/components/ui/InfoTip";

interface GridDimensionsConfigProps {
  isVisible: boolean;
  rows: number;
  columns: number;
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
    <div className="flex w-full flex-col gap-2 @lg:max-w-[180px]">
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
  onDimensionsChange,
  onReset,
  pressings,
}: GridDimensionsConfigProps) {
  if (!isVisible) return null;

  return (
    <div className="pr-8">
      <h3 className="mb-3 font-medium text-ink">Wall size</h3>
      <div className="flex flex-col gap-3 @lg:flex-row @lg:flex-wrap @lg:items-end @lg:gap-4">
        <DimensionField
          id="columns"
          label="Columns"
          value={columns}
          min={1}
          max={12}
          onCommit={(next) => onDimensionsChange(rows, next)}
        />

        <DimensionField
          id="rows"
          label="Rows"
          value={rows}
          min={1}
          max={10}
          onCommit={(next) => onDimensionsChange(next, columns)}
        />

        <div className="w-full @lg:ml-auto @lg:w-auto">
          <button
            onClick={onReset}
            className="w-full rounded-control bg-raised px-3 py-2 text-sm text-ink transition-colors hover:bg-line @lg:w-auto @lg:py-1"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Only offered when the collection has more than one pressing of an album. */}
      {pressings && pressings.groups.length > 0 && (
        <div className="mt-3">
          <span className="flex items-center gap-1">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                role="switch"
                checked={pressings.once}
                onChange={(event) => pressings.setOnce(event.target.checked)}
                aria-describedby="one-copy-tip"
                className="h-4 w-4 accent-accent"
              />
              One copy per album
            </label>
            <InfoTip
              id="one-copy-tip"
              label="One copy per album"
              text="Shows each album once, even if you own several copies."
            />
          </span>
          {pressings.once && (
            <p className="mt-1 text-xs text-muted">{pressings.hidden.length} set aside</p>
          )}
        </div>
      )}
    </div>
  );
}
