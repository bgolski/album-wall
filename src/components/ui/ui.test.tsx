import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ErrorMessage } from "./ErrorMessage";
import { LoadingSpinner } from "./LoadingSpinner";
import { SubmitButton } from "./SubmitButton";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("ErrorMessage", () => {
  it("renders error, username and retry button", () => {
    const mockRetry = vi.fn();
    render(<ErrorMessage error="Network error" username="alice" onRetry={mockRetry} />);
    expect(screen.getByText(/Network error/)).toBeTruthy();
    expect(
      screen.getByText(
        /We couldn't find "alice" on Discogs or encountered a problem loading their collection./
      )
    ).toBeTruthy();
    const button = screen.getByRole("button", { name: /Try Again/i });
    fireEvent.click(button);
    expect(mockRetry).toHaveBeenCalledOnce();
    const link = screen.getByRole("link", { name: /Visit Discogs/i });
    expect(link.getAttribute("href")).toBe("https://www.discogs.com/");
  });

  it("renders generic message when username is empty", () => {
    render(<ErrorMessage error="Auth error" username="" onRetry={vi.fn()} />);
    expect(screen.getByText(/Auth error/)).toBeTruthy();
    expect(screen.getByText(/There was a problem with the Discogs API./)).toBeTruthy();
  });
});

describe("LoadingSpinner", () => {
  it("renders an animated svg", () => {
    const { container } = render(<LoadingSpinner />);
    const svg = container.querySelector(".animate-spin");
    expect(svg).toBeTruthy();
  });
});

describe("SubmitButton", () => {
  it("calls onClick when not disabled", () => {
    const mockClick = vi.fn();
    render(<SubmitButton onClick={mockClick} disabled={false} isLoading={false} />);
    const button = screen.getByRole("button", { name: /Load Collection/i });
    fireEvent.click(button);
    expect(mockClick).toHaveBeenCalledOnce();
  });

  it("shows loading spinner and text when loading", () => {
    const { container } = render(
      <SubmitButton onClick={vi.fn()} disabled={false} isLoading={true} />
    );
    expect(screen.getByText(/Loading.../)).toBeTruthy();
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
  });

  it("is disabled when disabled prop is true", () => {
    const mockClick = vi.fn();
    render(<SubmitButton onClick={mockClick} disabled={true} isLoading={false} />);
    const button = screen.getByRole("button", { name: /Load Collection/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(mockClick).not.toHaveBeenCalled();
  });
});
