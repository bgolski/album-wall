import { useState } from "react";

const DEFAULT_ROWS = 4;
const DEFAULT_COLUMNS = 8;

/**
 * Manages configurable grid dimensions and exposes helpers for resetting and toggling the UI.
 *
 * @returns Current grid dimensions, derived grid size, and configuration actions.
 */
export function useGridDimensions() {
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [rows, setRows] = useState(DEFAULT_ROWS);
  const [showDimensionsConfig, setShowDimensionsConfig] = useState(false);

  const gridSize = rows * columns;

  /**
   * Updates the grid dimensions when both values are greater than zero.
   *
   * @param newRows Desired number of rows.
   * @param newColumns Desired number of columns.
   */
  const handleDimensionsChange = (newRows: number, newColumns: number) => {
    if (newRows < 1 || newColumns < 1) return;
    setRows(newRows);
    setColumns(newColumns);
  };

  /**
   * Restores the grid dimensions to the default 4x8 layout.
   */
  const resetToDefault = () => {
    handleDimensionsChange(DEFAULT_ROWS, DEFAULT_COLUMNS);
  };

  /**
   * Toggles visibility of the grid dimension configuration panel.
   */
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
