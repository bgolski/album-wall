import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WelcomeDialog } from "./WelcomeDialog";

afterEach(cleanup);

describe("WelcomeDialog", () => {
  it("offers the demo and the username path, and moves focus into the dialog", () => {
    render(<WelcomeDialog onTryDemo={vi.fn()} onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "New to Vinyl Wall?" });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(screen.getByRole("button", { name: "Try the demo" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "I'll use my username" })).toBeTruthy();
  });

  it("starts the demo from the primary button without also closing", () => {
    const onTryDemo = vi.fn();
    const onClose = vi.fn();
    render(<WelcomeDialog onTryDemo={onTryDemo} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Try the demo" }));
    expect(onTryDemo).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes from the username button, Escape and the backdrop, but not from the panel", () => {
    const onClose = vi.fn();
    render(<WelcomeDialog onTryDemo={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "I'll use my username" }));
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByTestId("welcome-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
