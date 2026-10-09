import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AppHeader } from "./AppHeader";

afterEach(cleanup);

describe("AppHeader", () => {
  it("has no demo link unless the demo is available", () => {
    render(<AppHeader />);
    expect(screen.queryByRole("button", { name: "Try the demo wall" })).toBeNull();
    expect(screen.getByRole("button", { name: /Switch to/ })).toBeTruthy();
  });

  it("offers the demo beside the theme switch and can disable it while loading", () => {
    const onTryDemo = vi.fn();
    const { rerender } = render(<AppHeader onTryDemo={onTryDemo} />);
    fireEvent.click(screen.getByRole("button", { name: "Try the demo wall" }));
    expect(onTryDemo).toHaveBeenCalledTimes(1);
    rerender(<AppHeader onTryDemo={onTryDemo} demoDisabled />);
    expect(
      (screen.getByRole("button", { name: "Try the demo wall" }) as HTMLButtonElement).disabled
    ).toBe(true);
  });
});
