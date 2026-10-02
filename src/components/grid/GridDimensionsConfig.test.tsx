import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GridDimensionsConfig } from "./GridDimensionsConfig";

const defaultRows = 3;
const defaultColumns = 4;

const baseProps = {
  isVisible: true,
  rows: defaultRows,
  columns: defaultColumns,
  gridSize: 12,
  defaultRows,
  defaultColumns,
  onDimensionsChange: vi.fn(),
  onReset: vi.fn(),
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GridDimensionsConfig", () => {
  it("renders nothing when not visible", () => {
    const { container } = render(<GridDimensionsConfig {...baseProps} isVisible={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows current rows, columns and gridSize", () => {
    render(<GridDimensionsConfig {...baseProps} />);
    const rowsInput = screen.getByLabelText(/rows/i) as HTMLInputElement;
    const colsInput = screen.getByLabelText(/columns/i) as HTMLInputElement;
    expect(rowsInput.value).toBe(String(defaultRows));
    expect(colsInput.value).toBe(String(defaultColumns));
    expect(screen.getByText(/Total albums in display:/)).toBeTruthy();
    expect(screen.getByText(String(baseProps.gridSize))).toBeTruthy();
  });

  it("calls onReset when reset button is clicked", () => {
    const onReset = vi.fn();
    // The button contains the default rows and columns in parentheses, e.g. "Reset to Default (3×4)".
    const { container } = render(<GridDimensionsConfig {...baseProps} onReset={onReset} />);
    const button = container.querySelector("button") as HTMLElement;
    fireEvent.click(button);
    expect(onReset).toHaveBeenCalled();
  });
});
