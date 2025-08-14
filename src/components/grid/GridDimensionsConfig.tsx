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
    <div className="bg-gray-700 p-3 rounded mt-3">
      <h3 className="text-white font-medium mb-3">Wall Display Dimensions</h3>
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <label htmlFor="rows" className="text-white">
            Rows:
          </label>
          <input
            id="rows"
            type="number"
            min="1"
            max="10"
            value={rows}
            onChange={(e) => onDimensionsChange(Number(e.target.value), columns)}
            className="w-16 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="columns" className="text-white">
            Columns:
          </label>
          <input
            id="columns"
            type="number"
            min="1"
            max="12"
            value={columns}
            onChange={(e) => onDimensionsChange(rows, Number(e.target.value))}
            className="w-16 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white"
          />
        </div>

        <p className="text-gray-300 text-sm">
          Total albums in display: <span className="font-semibold">{gridSize}</span>
        </p>

        <div className="ml-auto">
          <button
            onClick={onReset}
            className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-500"
          >
            Reset to Default ({defaultRows}×{defaultColumns})
          </button>
        </div>
      </div>

      <div className="mt-3 text-blue-300 text-xs">
        <p>Note: Changing dimensions will redistribute albums between the wall display and pool.</p>
      </div>
    </div>
  );
}
