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
        <div className="flex w-full flex-col gap-2 sm:max-w-[180px]">
          <label htmlFor="rows" className="text-sm text-ink">
            Rows:
          </label>
          <input
            id="rows"
            type="number"
            min="1"
            max="10"
            value={rows}
            onChange={(e) => onDimensionsChange(Number(e.target.value), columns)}
            className="w-full rounded-control border border-line bg-panel px-3 py-2 text-ink"
          />
        </div>

        <div className="flex w-full flex-col gap-2 sm:max-w-[180px]">
          <label htmlFor="columns" className="text-sm text-ink">
            Columns:
          </label>
          <input
            id="columns"
            type="number"
            min="1"
            max="12"
            value={columns}
            onChange={(e) => onDimensionsChange(rows, Number(e.target.value))}
            className="w-full rounded-control border border-line bg-panel px-3 py-2 text-ink"
          />
        </div>

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
        <p>Note: Changing dimensions will redistribute albums between the wall display and pool.</p>
      </div>
    </div>
  );
}
