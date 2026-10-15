import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DiscogsAccount } from "./DiscogsAccount";
import { ErrorMessage } from "../ui/ErrorMessage";

afterEach(cleanup);

const base = {
  busy: false,
  status: "idle" as const,
  error: null,
  onSignIn: vi.fn(),
  onSignOut: vi.fn(),
};

describe("DiscogsAccount", () => {
  it("offers sign-in and explains what is kept", () => {
    const onSignIn = vi.fn();
    render(<DiscogsAccount {...base} username={null} onSignIn={onSignIn} />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in with Discogs" }));
    expect(onSignIn).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "What is kept" }));
    expect(screen.getByText(/does not keep or log it/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Discogs application settings" })).toBeTruthy();
  });

  it("shows who is signed in and signs out", () => {
    const onSignOut = vi.fn();
    render(<DiscogsAccount {...base} username="Collector" onSignOut={onSignOut} />);
    expect(screen.getByText("Collector")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalled();
  });
});

describe("ErrorMessage for a private collection", () => {
  it("offers sign-in instead of trying again", () => {
    const onSignIn = vi.fn();
    render(
      <ErrorMessage
        error="Only its owner can open it."
        username="owner"
        onRetry={vi.fn()}
        kind="private-shared"
        onSignIn={onSignIn}
      />
    );
    expect(screen.getByText("Private Collection")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try Again" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sign in with Discogs" }));
    expect(onSignIn).toHaveBeenCalled();
  });
});
