import { describe, it, expect, vi, afterEach } from "vitest";
import { useState } from "react";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
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
  cleanup();
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

// Behaves like the real parent: the new size comes straight back in as props.
function Harness({ onChange }: { onChange: (rows: number, columns: number) => void }) {
  const [size, setSize] = useState({ rows: 4, columns: 4 });
  return (
    <GridDimensionsConfig
      {...baseProps}
      rows={size.rows}
      columns={size.columns}
      gridSize={size.rows * size.columns}
      onDimensionsChange={(rows, columns) => {
        setSize({ rows, columns });
        onChange(rows, columns);
      }}
    />
  );
}

describe("GridDimensionsConfig typing", () => {
  const rowsBox = () => screen.getByLabelText("Rows:") as HTMLInputElement;
  const type = (box: HTMLInputElement, value: string) =>
    fireEvent.change(box, { target: { value } });

  it("lets the number be cleared and retyped without changing the wall meanwhile", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    type(rowsBox(), "");
    expect(rowsBox().value).toBe("");
    expect(onChange).not.toHaveBeenCalled();

    type(rowsBox(), "6");
    expect(rowsBox().value).toBe("6");
    expect(onChange).toHaveBeenLastCalledWith(6, 4);
  });

  it("applies each valid number as it is typed", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    type(rowsBox(), "2");
    type(screen.getByLabelText("Columns:") as HTMLInputElement, "9");
    expect(onChange).toHaveBeenNthCalledWith(1, 2, 4);
    expect(onChange).toHaveBeenNthCalledWith(2, 2, 9);
  });

  it("does not apply zero, negatives or fractions", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    for (const bad of ["0", "-3", "2.5"]) type(rowsBox(), bad);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("caps a number above the maximum at the maximum", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    type(rowsBox(), "25");
    expect(onChange).toHaveBeenLastCalledWith(10, 4);
    expect(rowsBox().value).toBe("10");
  });

  it("shows the real value again when the box is left empty", () => {
    render(<Harness onChange={vi.fn()} />);
    type(rowsBox(), "");
    fireEvent.blur(rowsBox());
    expect(rowsBox().value).toBe("4");
  });

  it("asks for the number keypad on phones", () => {
    render(<Harness onChange={vi.fn()} />);
    expect(rowsBox().getAttribute("inputmode")).toBe("numeric");
  });
});
