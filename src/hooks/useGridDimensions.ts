import { useEffect, useState } from "react";

const DEFAULT_ROWS = 4;
const DEFAULT_COLUMNS = 8;
const MOBILE_DEFAULT_COLUMNS = 4;
const MOBILE_BREAKPOINT = 768;

function getDefaultGridDimensions() {
  if (typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT) {
    return { rows: DEFAULT_ROWS, columns: MOBILE_DEFAULT_COLUMNS };
  }

  return { rows: DEFAULT_ROWS, columns: DEFAULT_COLUMNS };
}

/**
 * Manages configurable grid dimensions and exposes helpers for resetting and toggling the UI.
 *
 * @returns Current grid dimensions, derived grid size, and configuration actions.
 */
export function useGridDimensions() {
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [rows, setRows] = useState(DEFAULT_ROWS);
  const [showDimensionsConfig, setShowDimensionsConfig] = useState(false);
  const viewportDefaults = getDefaultGridDimensions();

  useEffect(() => {
    const { rows: defaultRows, columns: defaultColumns } = getDefaultGridDimensions();
    setRows(defaultRows);
    setColumns(defaultColumns);
  }, []);

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
   * Restores the grid dimensions to the default layout for the current viewport.
   */
  const resetToDefault = () => {
    const { rows: defaultRows, columns: defaultColumns } = getDefaultGridDimensions();
    handleDimensionsChange(defaultRows, defaultColumns);
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
    DEFAULT_COLUMNS: viewportDefaults.columns,
  };
}
