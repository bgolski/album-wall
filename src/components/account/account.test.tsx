import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AccountMenu } from "./AccountMenu";
import { SignInButton } from "./SignInButton";
import { AppHeader } from "../layout/AppHeader";

afterEach(cleanup);

const base = {
  busy: false,
  status: "idle" as const,
  error: null,
  onSignIn: vi.fn(),
  onSignOut: vi.fn(),
};

describe("SignInButton", () => {
  it("signs in, and says what it is doing while Discogs opens", () => {
    const onClick = vi.fn();
    const { rerender } = render(<SignInButton onClick={onClick} status="idle" />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in with Discogs" }));
    expect(onClick).toHaveBeenCalledOnce();
    rerender(<SignInButton onClick={onClick} status="redirecting" />);
    const busy = screen.getByRole("button", { name: "Opening Discogs…" }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
  });
});

describe("AccountMenu", () => {
  it("shows who is signed in, loads their collection, and signs out", () => {
    const onSignOut = vi.fn();
    const onLoadOwn = vi.fn();
    render(
      <AccountMenu {...base} username="Collector" onSignOut={onSignOut} onLoadOwn={onLoadOwn} />
    );
    const button = screen.getByRole("button", { name: "Account: signed in as Collector" });
    expect(button.textContent).toBe("C");
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Collector")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Load my collection" }));
    expect(onLoadOwn).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();

    fireEvent.click(button);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it("closes on Escape and on a tap outside", () => {
    render(<AccountMenu {...base} username="Collector" />);
    const button = screen.getByRole("button", { name: /Account/ });
    fireEvent.click(button);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(button);
    fireEvent.pointerDown(document.body);
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("offers a small sign-in button when signed out", () => {
    const onSignIn = vi.fn();
    render(<AccountMenu {...base} username={null} onSignIn={onSignIn} />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(onSignIn).toHaveBeenCalledOnce();
  });
});

describe("AppHeader account corner", () => {
  it("leaves signing in to the start screen until a wall is showing", () => {
    const { rerender } = render(<AppHeader account={{ ...base, username: null }} />);
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
    rerender(<AppHeader account={{ ...base, username: null }} compact />);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
  });

  it("always shows the signed-in account and a sign-in problem", () => {
    render(
      <AppHeader account={{ ...base, username: "Collector", error: "Sign-in was cancelled." }} />
    );
    expect(screen.getByRole("button", { name: /signed in as Collector/ })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("Sign-in was cancelled.");
  });
});

describe("OwnCollectionButton", () => {
  it("loads the signed-in visitor's collection", async () => {
    const { OwnCollectionButton } = await import("./SignInButton");
    const onClick = vi.fn();
    render(<OwnCollectionButton username="Collector" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: /Load my collection/ }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
