import { useState } from "react";

interface GridDimensionsConfigProps {
  isVisible: boolean;
  rows: number;
  columns: number;
  gridSize: number;
  defaultRows: number;
  defaultColumns: number;
  onDimensionsChange: (rows: number, columns: number) => void;
  onReset: () => void;
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
}: GridDimensionsConfigProps) {
  if (!isVisible) return null;

  return (
    <div className="mt-3 rounded-control bg-raised p-3">
      <h3 className="mb-3 text-ink font-medium">Wall Display Dimensions</h3>
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:gap-4">
        <DimensionField
          id="rows"
          label="Rows:"
          value={rows}
          min={1}
          max={10}
          onCommit={(next) => onDimensionsChange(next, columns)}
        />

        <DimensionField
          id="columns"
          label="Columns:"
          value={columns}
          min={1}
          max={12}
          onCommit={(next) => onDimensionsChange(rows, next)}
        />

        <p className="text-sm text-muted md:pb-2">
          Total albums in display: <span className="font-semibold">{gridSize}</span>
        </p>

        <div className="w-full md:ml-auto md:w-auto">
          <button
            onClick={onReset}
            className="w-full rounded-control bg-raised px-3 py-2 text-sm text-ink transition-colors hover:bg-line md:w-auto md:py-1"
          >
            Reset to Default ({defaultRows}×{defaultColumns})
          </button>
        </div>
      </div>

      <div className="mt-3 text-xs text-accent">
        <p>
          Note: Changing dimensions will redistribute albums between the wall display and the
          remaining records.
        </p>
      </div>
    </div>
  );
}
