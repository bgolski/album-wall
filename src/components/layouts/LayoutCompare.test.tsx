import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Album, SharedWallState } from "@/types";
import { LayoutCompare } from "./LayoutCompare";

const albums: Album[] = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  title: `Album ${i + 1}`,
  artist: `Artist ${i + 1}`,
}));
const albumsById = new Map(albums.map((album) => [String(album.id), album]));
const wall = (ids: string[]): SharedWallState => ({
  v: 1,
  username: "someone",
  rows: 1,
  columns: 3,
  wallAlbumIds: ids,
  pinnedAlbumIds: [],
});

function renderCompare(current = wall(["2", "1", "6"]), target = wall(["1", "2", "3"])) {
  return render(
    <LayoutCompare currentWall={current} target={target} name="Autumn" albumsById={albumsById} />
  );
}

const cell = (row: number, column: number) =>
  within(screen.getByRole("group", { name: 'Diagram of "Autumn"' })).getByRole("button", {
    name: new RegExp(`^row ${row}, column ${column}:`),
  });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, "wakeLock", { configurable: true, value: undefined });
});

describe("LayoutCompare", () => {
  it("lists the steps in an order that works at the real wall", () => {
    renderCompare();
    const steps = within(screen.getByRole("list", { name: "Steps" })).getAllByRole("button");
    expect(steps.map((step) => step.textContent)).toEqual([
      "1. Take down Album 6 (Artist 6) from row 1, column 3",
      "2. Set Album 1 (Artist 1) aside from row 1, column 2 for a moment",
      "3. Move Album 2 (Artist 2) from row 1, column 1 to row 1, column 2",
      "4. Hang Album 1 (Artist 1), set aside earlier, at row 1, column 1",
      "5. Hang up Album 3 (Artist 3) at row 1, column 3",
    ]);
    expect(screen.getByText("0 albums stay where they are.")).toBeTruthy();
  });

  it("draws the saved wall with a numbered spot for every change", () => {
    renderCompare(wall(["1", "5", "6"]), wall(["1", "2", "6"]));
    expect(cell(1, 1).getAttribute("aria-label")).toBe(
      "row 1, column 1: Album 1 (Artist 1), stays"
    );
    expect(cell(1, 1).getAttribute("data-state")).toBe("stays");
    expect(cell(1, 2).getAttribute("aria-label")).toBe(
      "row 1, column 2: Album 2 (Artist 2), step 2"
    );
    expect(within(cell(1, 2)).getByText("2")).toBeTruthy();
  });

  it("outlines where a cover comes from and where it goes when a step is chosen", () => {
    renderCompare();
    fireEvent.click(screen.getByRole("button", { name: /^3\. Move Album 2/ }));
    expect(cell(1, 2).getAttribute("data-state")).toBe("destination");
    expect(cell(1, 1).getAttribute("data-state")).toBe("source");
    expect(screen.getByRole("status").textContent).toBe(
      "3. Move Album 2 (Artist 2) from row 1, column 1 to row 1, column 2"
    );
    expect(document.querySelector("svg line")).not.toBeNull();
  });

  it("selects a step by tapping its spot on the diagram", () => {
    renderCompare();
    fireEvent.click(cell(1, 3));
    expect(screen.getByRole("status").textContent).toMatch(/^5\. Hang up Album 3/);
  });

  it("walks through the steps with Start, Next and Previous", () => {
    renderCompare();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.getByText("Step 1 of 5")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Step 2 of 5")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("Step 1 of 5")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  it("ticks steps off", () => {
    renderCompare();
    fireEvent.click(screen.getByRole("checkbox", { name: "Step 1 done" }));
    expect(screen.getByText(/1 done/)).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Step 1 done" }));
    expect(screen.queryByText(/1 done/)).toBeNull();
  });

  it("says when nothing needs to change", () => {
    renderCompare(wall(["1", "2", "3"]), wall(["1", "2", "3"]));
    expect(screen.getByText(/Nothing to change/)).toBeTruthy();
  });

  it("offers Keep screen on only where the browser can do it, and asks for the lock", async () => {
    renderCompare();
    expect(screen.queryByLabelText("Keep screen on")).toBeNull();
    cleanup();

    const release = vi.fn(async () => {});
    const request = vi.fn(async () => ({ release }));
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request } });
    renderCompare();
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Keep screen on"));
    });
    expect(request).toHaveBeenCalledWith("screen");
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Keep screen on"));
    });
    expect(release).toHaveBeenCalled();
  });
});
