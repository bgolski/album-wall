import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Album, SharedWallState } from "@/types";
import { LayoutsPanel } from "./LayoutsPanel";
import { useHangHistory } from "@/hooks/useHangHistory";

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
  const onNotice = vi.fn();
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
      onNotice={onNotice}
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
        onNotice={onNotice}
      />
    );
  return { onApply, onNotice, rerenderWith };
}

function saveAs(name: string) {
  fireEvent.change(screen.getByLabelText("Name for the current wall"), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
}

/** Opens a saved wall's menu and picks one of its actions. */
function choose(wallName: string, item: string) {
  fireEvent.click(screen.getByRole("button", { name: `More for ${wallName}` }));
  fireEvent.click(screen.getByRole("menuitem", { name: item }));
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
        onNotice={vi.fn()}
      />
    );
    expect(screen.queryByText("Saved walls")).toBeNull();
  });

  it("is just a name, a Save button and the saved walls, with nothing written on it", () => {
    const { onNotice } = renderPanel();
    expect(screen.getByRole("heading", { name: "Saved walls" })).toBeTruthy();
    expect(screen.getByPlaceholderText("Name")).toBeTruthy();
    saveAs("Autumn");
    // Feedback is a short notice, not text left in the panel.
    expect(onNotice).toHaveBeenCalledWith("Saved Autumn");
    expect(screen.queryByRole("status")).toBeNull();
    expect(
      within(screen.getByRole("list", { name: "Saved walls" })).getByText("Autumn")
    ).toBeTruthy();
    // A wall just saved is not selected: it has Use like the others, its name opens a preview,
    // and its menu holds the rest. No size or date line.
    const row = screen.getAllByRole("listitem")[0]!;
    expect(
      within(row)
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual(["Autumn", "Use", ""]);
    expect(row.textContent).toBe("AutumnUse");
    expect(screen.queryByRole("img", { name: "Showing now" })).toBeNull();
  });

  it("names a wall itself when no name is given", () => {
    const { onNotice } = renderPanel();
    saveAs("   ");
    expect(onNotice).toHaveBeenLastCalledWith("Saved Wall 1");
    saveAs("");
    expect(onNotice).toHaveBeenLastCalledWith("Saved Wall 2");
  });

  it("puts a saved wall on the wall as one change, with no Undo of its own", () => {
    const { onApply, rerenderWith } = renderPanel(wall(["1", "2", "3"], ["2"]));
    saveAs("Autumn");
    rerenderWith(wall(["4", "5", "6"]));
    fireEvent.click(screen.getByRole("button", { name: "Use Autumn on the wall" }));
    expect(onApply).toHaveBeenLastCalledWith(wall(["1", "2", "3"], ["2"]));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    // Once the wall is that saved wall, Use has nothing left to do.
    rerenderWith(wall(["1", "2", "3"], ["2"]));
    expect(screen.queryByRole("button", { name: "Use Autumn on the wall" })).toBeNull();
  });

  it("marks the saved wall that was used while it is showing, and stops when the wall is edited", () => {
    const { rerenderWith } = renderPanel(wall(["1", "2", "3"]));
    saveAs("Autumn");
    saveAs("Winter");
    // Saving does not select anything, even though both match the wall as it is now.
    expect(screen.queryByRole("img", { name: "Showing now" })).toBeNull();
    // Use one: only that one is selected, and it has no Use left.
    fireEvent.click(screen.getByRole("button", { name: "Use Autumn on the wall" }));
    expect(screen.getAllByRole("img", { name: "Showing now" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Use Autumn on the wall" })).toBeNull();
    expect(screen.getByRole("button", { name: "Use Winter on the wall" })).toBeTruthy();
    // Moving an album, or pinning one, is an edit.
    rerenderWith(wall(["2", "1", "3"]));
    expect(screen.queryByRole("img", { name: "Showing now" })).toBeNull();
    rerenderWith(wall(["1", "2", "3"], ["1"]));
    expect(screen.queryByRole("img", { name: "Showing now" })).toBeNull();
    rerenderWith(wall(["1", "2", "3"]));
    expect(screen.getAllByRole("img", { name: "Showing now" })).toHaveLength(1);
  });

  it("shows a small picture of a saved wall when its name is pressed", () => {
    const { rerenderWith } = renderPanel(wall(["1", "2", "3"]));
    saveAs("Autumn");
    rerenderWith(wall(["4", "5", "6"]));
    expect(screen.queryByRole("img", { name: "Autumn: 3 albums" })).toBeNull();
    const row = screen.getAllByRole("listitem")[0]!;
    expect(row.className).not.toContain("ring-2");
    fireEvent.click(screen.getByRole("button", { name: "Autumn" }));
    // The selected wall has a ring around it, with its picture open.
    expect(row.className).toContain("ring-2");
    const picture = screen.getByRole("img", { name: "Autumn: 3 albums" });
    expect(picture.querySelectorAll("img")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Autumn" }));
    expect(screen.queryByRole("img", { name: "Autumn: 3 albums" })).toBeNull();
    expect(row.className).not.toContain("ring-2");
  });

  it("guides hanging a saved wall one step at a time, and can be cancelled", () => {
    const { onApply, rerenderWith } = renderPanel(wall(["1", "2", "3"]));
    saveAs("Autumn");
    rerenderWith(wall(["2", "1", "6"]));
    choose("Autumn", "Rehang");
    const guide = screen.getByRole("group", { name: "Hang Autumn" });
    expect(within(guide).getByText(/^1 \/ \d+$/)).toBeTruthy();
    fireEvent.click(within(guide).getByRole("button", { name: "Done" }));
    expect(within(guide).getByText(/^2 \/ \d+$/)).toBeTruthy();
    // Cancelling goes back to the list, and the wall is untouched.
    fireEvent.click(within(guide).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("group", { name: "Hang Autumn" })).toBeNull();
    expect(screen.getByRole("list", { name: "Saved walls" })).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled();
  });

  it("takes over the panel while hanging, and finishing puts the saved wall on screen", () => {
    const { onApply, onNotice, rerenderWith } = renderPanel(wall(["1", "2", "3"]));
    saveAs("Autumn");
    rerenderWith(wall(["4", "5", "6"]));
    choose("Autumn", "Rehang");
    // Only the guide is shown.
    expect(screen.queryByPlaceholderText("Name")).toBeNull();
    expect(screen.queryByRole("list", { name: "Saved walls" })).toBeNull();
    for (let i = 0; i < 3; i += 1) fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onApply).toHaveBeenLastCalledWith(wall(["1", "2", "3"]));
    expect(onNotice).toHaveBeenLastCalledWith("Done");
    // Back to the list.
    expect(screen.getByRole("list", { name: "Saved walls" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Hang Autumn" })).toBeNull();
  });

  it("says when the wall already matches, instead of opening a guide", () => {
    const { onNotice } = renderPanel();
    saveAs("Autumn");
    choose("Autumn", "Rehang");
    expect(onNotice).toHaveBeenLastCalledWith("Already matches");
    expect(screen.queryByRole("group", { name: "Hang Autumn" })).toBeNull();
  });

  it("renames and, after confirming, deletes a saved wall", () => {
    renderPanel();
    saveAs("Autumn");
    choose("Autumn", "Rename");
    fireEvent.change(screen.getByLabelText("New name for Autumn"), { target: { value: "Spring" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[1]!);
    expect(screen.getByText("Spring")).toBeTruthy();

    choose("Spring", "Delete");
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    expect(screen.getByText("Spring")).toBeTruthy();
    choose("Spring", "Delete");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.queryByRole("list", { name: "Saved walls" })).toBeNull();
  });

  it("closes a menu with Escape", () => {
    renderPanel();
    saveAs("Autumn");
    fireEvent.click(screen.getByRole("button", { name: "More for Autumn" }));
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("offers a backup file only once there is something to back up", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Backup" }));
    expect(screen.getByRole("menuitem", { name: "Load backup file" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Save backup file" })).toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    saveAs("Autumn");
    fireEvent.click(screen.getByRole("button", { name: "Backup" }));
    expect(screen.getByRole("menuitem", { name: "Save backup file" })).toBeTruthy();
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

    const { onNotice } = renderPanel();
    saveAs("Autumn");
    fireEvent.click(screen.getByRole("button", { name: "Backup" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Save backup file" }));
    expect(click).toHaveBeenCalled();
    expect(onNotice).toHaveBeenLastCalledWith("Backup saved");
    const backup = await created[0]!.text();

    choose("Autumn", "Delete");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.change(screen.getByLabelText("Load backup file"), {
      target: { files: [new File([backup], "layouts.json", { type: "application/json" })] },
    });
    await waitFor(() => expect(onNotice).toHaveBeenLastCalledWith("Added 1 saved wall."));
    expect(screen.getByText("Autumn")).toBeTruthy();
  });

  it("marks a saved wall as on your wall", () => {
    const storage = fakeStorage();
    let id = 0;
    const storageOptions = { storage, newId: () => `id-${++id}` };
    function WithHistory() {
      const history = useHangHistory("someone", {
        storage,
        now: () => new Date(2026, 9, 14),
      });
      return (
        <LayoutsPanel
          isVisible
          collectionName="someone"
          currentWall={wall(["1", "2", "3"])}
          albums={albums}
          onApply={vi.fn()}
          storageOptions={storageOptions}
          history={history}
          onNotice={vi.fn()}
        />
      );
    }
    render(<WithHistory />);
    expect(screen.queryByRole("img", { name: "On my wall" })).toBeNull();

    saveAs("Autumn");
    choose("Autumn", "Mark as on my wall");
    // Nothing is drawn on the row; the menu says which one it is.
    expect(screen.queryByRole("img", { name: "On my wall" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "More for Autumn" }));
    expect(screen.getByRole("menuitem", { name: "On my wall" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Mark as on my wall" })).toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });

    // Marking another saved wall moves it there.
    saveAs("Winter");
    choose("Winter", "Mark as on my wall");
    fireEvent.click(screen.getByRole("button", { name: "More for Autumn" }));
    expect(screen.getByRole("menuitem", { name: "Mark as on my wall" })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(JSON.parse(storage.getItem("album-wall:hang-history:someone")!).hangs).toEqual([
      { date: "2026-10-14", albumIds: ["1", "2", "3"], layoutId: "id-2", rows: 1, columns: 3 },
    ]);
  });

  describe("history", () => {
    function renderWithHistory(onApply = vi.fn()) {
      const storage = fakeStorage();
      storage.setItem(
        "album-wall:hang-history:someone",
        JSON.stringify({
          v: 1,
          hangs: [
            { date: "2026-09-02", albumIds: ["4", "5", "6"], rows: 1, columns: 3 },
            { date: "2026-10-01", albumIds: ["2", "3", "9"] },
            { date: "2026-10-14", albumIds: ["1", "2", "3"], rows: 1, columns: 3 },
          ],
        })
      );
      const onNotice = vi.fn();
      function WithHistory() {
        const history = useHangHistory("someone", { storage });
        return (
          <LayoutsPanel
            isVisible
            collectionName="someone"
            currentWall={wall(["1", "2", "3"])}
            albums={albums}
            onApply={onApply}
            storageOptions={{ storage }}
            history={history}
            onNotice={onNotice}
          />
        );
      }
      render(<WithHistory />);
      return { onApply, onNotice };
    }

    it("lists the walls that were hung, newest first, below the saved walls", () => {
      renderWithHistory();
      const list = screen.getByRole("list", { name: "History" });
      const days = within(list)
        .getAllByRole("button", { expanded: false })
        .map((button) => button.textContent);
      expect(days).toHaveLength(3);
      expect(days[0]).toContain("2026");
      expect(screen.getByRole("heading", { name: "History" })).toBeTruthy();
    });

    it("shows a picture of an earlier wall, and puts it back with Use", () => {
      const { onApply } = renderWithHistory();
      const list = screen.getByRole("list", { name: "History" });
      const first = within(list).getAllByRole("button", { expanded: false })[0]!;
      fireEvent.click(first);
      expect(within(list).getByRole("img", { name: /3 albums/ })).toBeTruthy();

      fireEvent.click(within(list).getAllByRole("button", { name: /^Use the wall from/ })[0]!);
      expect(onApply).toHaveBeenCalledWith(
        expect.objectContaining({ rows: 1, columns: 3, wallAlbumIds: ["1", "2", "3"] })
      );
    });

    it("works out the shape of a wall recorded before shapes were kept", () => {
      const { onApply, onNotice } = renderWithHistory();
      const uses = screen.getAllByRole("button", { name: /^Use the wall from/ });
      // The middle one (1 Oct) has no shape and names an album that is no longer there.
      fireEvent.click(uses[1]!);
      expect(onApply).toHaveBeenCalledWith(
        expect.objectContaining({ columns: 3, rows: 1, wallAlbumIds: ["2", "3", "9"] })
      );
      expect(onNotice).toHaveBeenCalledWith("1 no longer in the collection");
    });
  });
});
