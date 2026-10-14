import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Album, SharedWallState } from "@/types";
import { LayoutsPanel } from "./LayoutsPanel";

const albums: Album[] = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  title: `Album ${i + 1}`,
  artist: `Artist ${i + 1}`,
}));

const wall = (ids: string[], pins: string[] = []): SharedWallState => ({
  v: 1,
  username: "someone",
  rows: 1,
  columns: 3,
  wallAlbumIds: ids,
  pinnedAlbumIds: pins,
});

function fakeStorage() {
  const data: Record<string, string> = {};
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

function renderPanel(currentWall = wall(["1", "2", "3"]), onApply = vi.fn()) {
  let id = 0;
  const storageOptions = { storage: fakeStorage(), newId: () => `id-${++id}` };
  const view = render(
    <LayoutsPanel
      isVisible
      collectionName="someone"
      currentWall={currentWall}
      albums={albums}
      onApply={onApply}
      storageOptions={storageOptions}
    />
  );
  const rerenderWith = (next: SharedWallState) =>
    view.rerender(
      <LayoutsPanel
        isVisible
        collectionName="someone"
        currentWall={next}
        albums={albums}
        onApply={onApply}
        storageOptions={storageOptions}
      />
    );
  return { onApply, rerenderWith };
}

function saveAs(name: string) {
  fireEvent.change(screen.getByLabelText("Name for the current wall"), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: "Save current wall" }));
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("LayoutsPanel", () => {
  it("shows nothing when closed", () => {
    render(
      <LayoutsPanel
        isVisible={false}
        collectionName="someone"
        currentWall={wall(["1"])}
        albums={albums}
        onApply={vi.fn()}
      />
    );
    expect(screen.queryByText("Layouts")).toBeNull();
  });

  it("says layouts live in this browser and asks for a backup once one is saved", () => {
    renderPanel();
    expect(screen.getByText(/kept in this browser only/)).toBeTruthy();
    expect(screen.queryByText(/not backed up yet/)).toBeNull();
    saveAs("Autumn");
    expect(screen.getByText(/not backed up yet/)).toBeTruthy();
    expect(screen.getByText('Saved "Autumn".')).toBeTruthy();
    expect(
      within(screen.getByRole("list", { name: "Saved layouts" })).getByText("Autumn")
    ).toBeTruthy();
  });

  it("explains a missing name", () => {
    renderPanel();
    saveAs("   ");
    expect(screen.getByText("Give the layout a name.")).toBeTruthy();
  });

  it("puts a saved wall on the wall, and Undo puts the previous one back", () => {
    const { onApply, rerenderWith } = renderPanel(wall(["1", "2", "3"], ["2"]));
    saveAs("Autumn");
    rerenderWith(wall(["4", "5", "6"]));
    fireEvent.click(screen.getByRole("button", { name: "Put Autumn on the wall" }));
    expect(onApply).toHaveBeenLastCalledWith(wall(["1", "2", "3"], ["2"]));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onApply).toHaveBeenLastCalledWith(wall(["4", "5", "6"]));
  });

  it("shows the steps to reach a saved wall", () => {
    const { rerenderWith } = renderPanel(wall(["1", "2", "3"]));
    saveAs("Autumn");
    rerenderWith(wall(["2", "1", "6"]));
    fireEvent.click(screen.getByRole("button", { name: "Compare Autumn with the wall" }));
    expect(screen.getByRole("group", { name: 'Diagram of "Autumn"' })).toBeTruthy();
    expect(screen.getByText("1. Take down Album 6 (Artist 6) from row 1, column 3")).toBeTruthy();
    expect(screen.getByText("5. Hang up Album 3 (Artist 3) at row 1, column 3")).toBeTruthy();
  });

  it("says when the wall already matches", () => {
    renderPanel();
    saveAs("Autumn");
    fireEvent.click(screen.getByRole("button", { name: "Compare Autumn with the wall" }));
    expect(screen.getByText(/Nothing to change/)).toBeTruthy();
  });

  it("renames and, after confirming, deletes a layout", () => {
    renderPanel();
    saveAs("Autumn");
    fireEvent.click(screen.getByRole("button", { name: "Rename Autumn" }));
    fireEvent.change(screen.getByLabelText("New name for Autumn"), { target: { value: "Spring" } });
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));
    expect(screen.getByText("Spring")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Delete Spring" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    expect(screen.getByText("Spring")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete Spring" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.queryByRole("list", { name: "Saved layouts" })).toBeNull();
  });

  it("saves a backup file and loads one back", async () => {
    const created: Blob[] = [];
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: (blob: Blob) => {
        created.push(blob);
        return "blob:backup";
      },
    });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: () => {} });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    renderPanel();
    saveAs("Autumn");
    fireEvent.click(screen.getByRole("button", { name: "Save backup file" }));
    expect(click).toHaveBeenCalled();
    expect(screen.queryByText(/not backed up yet/)).toBeNull();
    const backup = await created[0]!.text();

    fireEvent.click(screen.getByRole("button", { name: "Delete Autumn" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.change(screen.getByLabelText("Load backup file"), {
      target: { files: [new File([backup], "layouts.json", { type: "application/json" })] },
    });
    await waitFor(() => expect(screen.getByText("Added 1 layout.")).toBeTruthy());
    expect(screen.getByText("Autumn")).toBeTruthy();
  });
});
