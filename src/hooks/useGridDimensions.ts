import { useCallback, useEffect, useState } from "react";

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

interface InitialGridDimensions {
  rows: number;
  columns: number;
}

/**
 * Manages configurable grid dimensions and exposes helpers for resetting and toggling the UI.
 *
 * @param initialDimensions Optional initial dimensions, typically from shared wall state.
 * @returns Current grid dimensions, derived grid size, and configuration actions.
 */
export function useGridDimensions(initialDimensions?: InitialGridDimensions) {
  const resolvedInitialDimensions = initialDimensions ?? getDefaultGridDimensions();
  const [columns, setColumns] = useState(resolvedInitialDimensions.columns);
  const [rows, setRows] = useState(resolvedInitialDimensions.rows);
  const [showDimensionsConfig, setShowDimensionsConfig] = useState(false);
  const viewportDefaults = getDefaultGridDimensions();

  useEffect(() => {
    if (initialDimensions) {
      return;
    }

    const { rows: defaultRows, columns: defaultColumns } = getDefaultGridDimensions();
    setRows(defaultRows);
    setColumns(defaultColumns);
  }, [initialDimensions]);

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
   * Replaces the current grid dimensions, typically when hydrating shared wall state.
   *
   * @param newRows Desired number of grid rows.
   * @param newColumns Desired number of grid columns.
   */
  const replaceDimensions = useCallback((newRows: number, newColumns: number) => {
    if (newRows < 1 || newColumns < 1) return;
    setRows(newRows);
    setColumns(newColumns);
  }, []);

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
    replaceDimensions,
    resetToDefault,
    toggleConfig,
    DEFAULT_ROWS,
    DEFAULT_COLUMNS: viewportDefaults.columns,
  };
}
