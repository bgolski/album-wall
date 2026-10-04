import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeToggle } from "./ThemeToggle";

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
  };
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("dark");
    vi.stubGlobal("localStorage", fakeStorage());
  });

  afterEach(() => {
    cleanup();
    document.documentElement.classList.remove("dark");
    vi.unstubAllGlobals();
  });

  it("offers dark mode in light mode and switches, remembering the choice", async () => {
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: "Switch to dark mode" });
    fireEvent.click(button);

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("theme")).toBe("dark");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeTruthy()
    );
  });

  it("starts from a dark page and switches back to light", async () => {
    document.documentElement.classList.add("dark");
    render(<ThemeToggle />);
    fireEvent.click(await screen.findByRole("button", { name: "Switch to light mode" }));

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("still switches when storage is unavailable", async () => {
    vi.stubGlobal("localStorage", {
      ...fakeStorage(),
      setItem: () => {
        throw new Error("blocked");
      },
    });
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
