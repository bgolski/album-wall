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
  it("offers to try again after an unexpected failure", () => {
    const mockRetry = vi.fn();
    render(<ErrorMessage error="Network error" username="alice" onRetry={mockRetry} />);
    expect(screen.getByRole("heading", { name: "The collection didn't load" })).toBeTruthy();
    expect(screen.getByText("Network error")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mockRetry).toHaveBeenCalledOnce();
  });

  it("says a name was not found without offering a retry that would fail the same way", () => {
    render(<ErrorMessage error="x" username="alice" kind="not-found" onRetry={vi.fn()} />);
    expect(screen.getByRole("heading", { name: 'No Discogs user "alice"' })).toBeTruthy();
    expect(screen.getByText(/Check the spelling/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each([
    ["busy", "Discogs needs a short break"],
    ["unavailable", "Discogs isn't answering"],
  ] as const)(
    "asks to try again later when Discogs is %s, without blaming the name",
    (kind, heading) => {
      render(<ErrorMessage error="x" username="alice" kind={kind} onRetry={vi.fn()} />);
      expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
      expect(screen.queryByText(/alice/)).toBeNull();
      expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    }
  );

  it.each(["private", "signed-out"] as const)("offers sign-in for %s", (kind) => {
    const onSignIn = vi.fn();
    render(
      <ErrorMessage
        error="Why"
        username="alice"
        kind={kind}
        onRetry={vi.fn()}
        onSignIn={onSignIn}
      />
    );
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sign in with Discogs" }));
    expect(onSignIn).toHaveBeenCalledOnce();
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
