import { useState } from "react";

const DEFAULT_ROWS = 4;
const DEFAULT_COLUMNS = 8;

export function useGridDimensions() {
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [rows, setRows] = useState(DEFAULT_ROWS);
  const [showDimensionsConfig, setShowDimensionsConfig] = useState(false);

  const gridSize = rows * columns;

  const handleDimensionsChange = (newRows: number, newColumns: number) => {
    if (newRows < 1 || newColumns < 1) return;
    setRows(newRows);
    setColumns(newColumns);
  };

  const resetToDefault = () => {
    handleDimensionsChange(DEFAULT_ROWS, DEFAULT_COLUMNS);
  };

  const toggleConfig = () => {
    setShowDimensionsConfig(!showDimensionsConfig);
  };

  return {
    rows,
    columns,
    gridSize,
    showDimensionsConfig,
    handleDimensionsChange,
    resetToDefault,
    toggleConfig,
    DEFAULT_ROWS,
    DEFAULT_COLUMNS,
  };
}
