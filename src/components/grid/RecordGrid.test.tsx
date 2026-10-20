import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { RecordGrid } from "./RecordGrid";
import { Album } from "@/types";
import { decodeSharedWallState } from "@/utils/shareState";

const albums: Album[] = Array.from({ length: 40 }, (_, index) => ({
  id: index + 1,
  title: `Album ${index + 1}`,
  artist: `Artist ${index + 1}`,
}));

function renderGrid(onAlbumsReorder = vi.fn(), wideScreen = true) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: wideScreen,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
  render(<RecordGrid username="someone" albums={albums} onAlbumsReorder={onAlbumsReorder} />);
  return onAlbumsReorder;
}

function tile(title: string) {
  return screen.getByAltText(title).closest("[data-album-id]") as HTMLElement;
}

describe("RecordGrid tap actions", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("opens an action sheet when an album is tapped", () => {
    renderGrid();
    fireEvent.click(tile("Album 1"));
    const dialog = screen.getByRole("dialog", { name: "Album 1 actions" });
    expect(within(dialog).getByText("Artist 1")).toBeTruthy();
  });

  it("closes the sheet with Escape and with the backdrop", () => {
    renderGrid();
    fireEvent.click(tile("Album 1"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(tile("Album 1"));
    fireEvent.click(screen.getByTestId("album-sheet-backdrop"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("pins an album from the sheet", () => {
    renderGrid();
    fireEvent.click(tile("Album 1"));
    fireEvent.click(screen.getByRole("button", { name: "Pin in place" }));
    expect(tile("Album 1").getAttribute("data-pinned")).toBe("true");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("pins and unpins from the badge without opening the sheet", () => {
    renderGrid();
    fireEvent.click(screen.getByRole("button", { name: "Pin Album 2" }));
    expect(tile("Album 2").getAttribute("data-pinned")).toBe("true");
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Unpin Album 2" }));
    expect(tile("Album 2").getAttribute("data-pinned")).toBe("false");
  });

  it("swaps two albums by choosing Move and tapping another album", () => {
    const onAlbumsReorder = renderGrid();
    fireEvent.click(tile("Album 1"));
    fireEvent.click(screen.getByRole("button", { name: /^Swap with/ }));
    expect(screen.getByTestId("move-banner").textContent).toContain("Moving Album 1");

    fireEvent.click(tile("Album 3"));
    expect(onAlbumsReorder).toHaveBeenCalledTimes(1);
    expect(onAlbumsReorder.mock.calls[0]![0].map((a: Album) => a.id).slice(0, 3)).toEqual([
      3, 2, 1,
    ]);
    expect(screen.queryByTestId("move-banner")).toBeNull();
  });

  it("swaps a wall album with a pool album", () => {
    const onAlbumsReorder = renderGrid();
    fireEvent.click(tile("Album 1"));
    fireEvent.click(screen.getByRole("button", { name: /^Swap with/ }));
    fireEvent.click(tile("Album 40"));
    const order = onAlbumsReorder.mock.calls[0]![0].map((a: Album) => a.id);
    expect(order[0]).toBe(40);
    expect(order[39]).toBe(1);
  });

  it("cancels a move by tapping the same album or Cancel", () => {
    const onAlbumsReorder = renderGrid();
    fireEvent.click(tile("Album 1"));
    fireEvent.click(screen.getByRole("button", { name: /^Swap with/ }));
    fireEvent.click(tile("Album 1"));
    expect(screen.queryByTestId("move-banner")).toBeNull();

    fireEvent.click(tile("Album 1"));
    fireEvent.click(screen.getByRole("button", { name: /^Swap with/ }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByTestId("move-banner")).toBeNull();
    expect(onAlbumsReorder).not.toHaveBeenCalled();
  });

  it("refuses to swap with a pinned album and keeps the move going", () => {
    const onAlbumsReorder = renderGrid();
    fireEvent.click(screen.getByRole("button", { name: "Pin Album 2" }));
    fireEvent.click(tile("Album 1"));
    fireEvent.click(screen.getByRole("button", { name: /^Swap with/ }));
    fireEvent.click(tile("Album 2"));
    expect(onAlbumsReorder).not.toHaveBeenCalled();
    expect(screen.getByTestId("move-banner").textContent).toContain(
      "Pinned albums can't be swapped"
    );
  });

  it("does not offer Move for a pinned album", () => {
    renderGrid();
    fireEvent.click(screen.getByRole("button", { name: "Pin Album 1" }));
    fireEvent.click(tile("Album 1"));
    const move = screen.getByRole("button", { name: /Unpin to swap/ }) as HTMLButtonElement;
    expect(move.disabled).toBe(true);
  });

  it("opens one panel at a time beside the wall and closes it", async () => {
    renderGrid();
    const sizeButton = screen.getByRole("button", { name: "Wall size" });
    sizeButton.focus();
    fireEvent.click(sizeButton);
    expect(screen.getByRole("heading", { name: "Wall size" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Saved walls" }));
    expect(screen.queryByRole("heading", { name: "Wall size" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Saved walls" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close Saved walls" }));
    expect(screen.queryByRole("heading", { name: "Saved walls" })).toBeNull();
    expect(screen.getByTestId("docked-panel").hidden).toBe(true);

    fireEvent.click(sizeButton);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("heading", { name: "Wall size" })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(sizeButton));
  });

  it("draws no drag grip over the covers", () => {
    renderGrid();
    expect(screen.queryByRole("button", { name: /^Drag / })).toBeNull();
  });

  it("keeps sharing out of the Export menu", () => {
    renderGrid();
    fireEvent.click(screen.getByRole("button", { name: /Save image/ }));
    expect(screen.getByRole("menuitem", { name: "Wall as shown" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: /Share/ })).toBeNull();
  });

  it("shares the wall link through the share sheet when there is one", async () => {
    const share = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { ...navigator, share });
    renderGrid();
    fireEvent.click(screen.getByRole("button", { name: "Share link" }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const [data] = share.mock.calls[0] as unknown as [{ url: string }];
    expect(data.url).toContain("#");
  });

  it("copies the wall link when there is no share sheet, and says so", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { ...navigator, share: undefined, clipboard: { writeText } });
    renderGrid();
    fireEvent.click(screen.getByRole("button", { name: "Share link" }));
    const line = await screen.findByText("Share link copied.");
    expect(line.closest("[role=status]")).toBeTruthy();
    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it("marks the Export button as a menu button and the menu as a menu", () => {
    renderGrid();
    const trigger = screen.getByRole("button", { name: /Save image/ });
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const menu = screen.getByRole("menu", { name: "Image sizes" });
    expect(trigger.getAttribute("aria-controls")).toBe(menu.id);
  });

  it("moves focus into the menu, steps with the arrow keys and wraps", () => {
    renderGrid();
    fireEvent.click(screen.getByRole("button", { name: /Save image/ }));
    const items = screen.getAllByRole("menuitem");
    expect(document.activeElement).toBe(items[0]);

    fireEvent.keyDown(items[0]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(items[1]!, { key: "ArrowUp" });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(items[0]!, { key: "ArrowUp" });
    expect(document.activeElement).toBe(items[items.length - 1]);
    fireEvent.keyDown(items[items.length - 1]!, { key: "Home" });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(items[0]!, { key: "End" });
    expect(document.activeElement).toBe(items[items.length - 1]);
  });

  it("closes on Escape and returns focus to the Export button", () => {
    renderGrid();
    const trigger = screen.getByRole("button", { name: /Save image/ });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getAllByRole("menuitem")[0]!, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes on a click outside without taking focus from what was clicked", () => {
    renderGrid();
    fireEvent.click(screen.getByRole("button", { name: /Save image/ }));
    const other = screen.getByRole("button", { name: "Pin Album 2" });
    other.focus();
    fireEvent.pointerDown(other);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(other);
  });

  it("announces a keyboard drag with album names and slots", async () => {
    renderGrid();
    const first = tile("Album 1");
    first.focus();
    fireEvent.keyDown(first, { code: "Space", key: " " });
    await waitFor(() => {
      const live = document.querySelector("[id^=DndLiveRegion]");
      expect(live?.textContent).toContain("Picked up Album 1 by Artist 1, wall slot 1.");
    });
    fireEvent.keyDown(first, { code: "Escape", key: "Escape" });
    await waitFor(() => {
      const live = document.querySelector("[id^=DndLiveRegion]");
      expect(live?.textContent).toContain(
        "Move cancelled. Album 1 by Artist 1 stays in wall slot 1."
      );
    });
  });

  it("gives a pinned tile a name that says it is pinned", () => {
    renderGrid();
    fireEvent.click(screen.getByRole("button", { name: "Pin Album 3" }));
    expect(tile("Album 3").getAttribute("aria-label")).toBe("Album 3 by Artist 3, pinned");
    expect(tile("Album 4").getAttribute("aria-label")).toBe("Album 4 by Artist 4");
  });

  it("swaps a wall album with a pool album found through the pool search", () => {
    const onAlbumsReorder = renderGrid();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), {
      target: { value: "Album 40" },
    });
    expect(screen.queryByAltText("Album 39")).toBeNull();

    fireEvent.click(tile("Album 40"));
    fireEvent.click(screen.getByRole("button", { name: /^Swap with/ }));
    fireEvent.click(tile("Album 1"));

    const order = onAlbumsReorder.mock.calls[0]![0].map((a: Album) => a.id);
    expect(order[0]).toBe(40);
    expect(order[39]).toBe(1);
  });

  it("shows album labels by default on a wide screen and hides them on a narrow one", () => {
    renderGrid(vi.fn(), true);
    expect(screen.getByRole("button", { name: "Labels" })).toBeTruthy();
    cleanup();

    renderGrid(vi.fn(), false);
    expect(screen.getByRole("button", { name: "Labels" })).toBeTruthy();
  });

  it("lets the user override the label default", () => {
    renderGrid(vi.fn(), false);
    fireEvent.click(screen.getByRole("button", { name: "Labels" }));
    expect(screen.getByRole("button", { name: "Labels" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Labels" }));
    expect(screen.getByRole("button", { name: "Labels" })).toBeTruthy();
  });
});

describe("RecordGrid undo, memory and sized exports", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function renderWithUndo(onUndo = vi.fn(() => true)) {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    );
    render(
      <RecordGrid
        username="someone"
        albums={albums}
        onAlbumsReorder={vi.fn()}
        canUndo
        onUndo={onUndo}
      />
    );
    return onUndo;
  }

  it("undoes from the button and says so", () => {
    const onUndo = renderWithUndo();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Undid the last change.")).toBeTruthy();
  });

  it("undoes with Ctrl+Z or Cmd+Z, but not while typing in a field", () => {
    const onUndo = renderWithUndo();
    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
    fireEvent.keyDown(document.body, { key: "z", metaKey: true });
    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(document.body, { key: "z" });
    expect(onUndo).toHaveBeenCalledTimes(2);

    const search = screen.getByRole("searchbox");
    fireEvent.keyDown(search, { key: "z", ctrlKey: true });
    expect(onUndo).toHaveBeenCalledTimes(2);
  });

  it("remembers the wall on this device", () => {
    renderWithUndo();
    const saved = window.localStorage.getItem("album-wall:wall:someone");
    expect(saved).toBeTruthy();
    expect(decodeSharedWallState(saved ?? "")).toMatchObject({
      username: "someone",
      wallAlbumIds: albums.slice(0, 32).map((album) => String(album.id)),
      pinnedAlbumIds: [],
    });

    fireEvent.click(screen.getByRole("button", { name: "Pin Album 1" }));
    expect(
      decodeSharedWallState(window.localStorage.getItem("album-wall:wall:someone") ?? "")
    ).toMatchObject({ pinnedAlbumIds: ["1"] });
  });

  it("offers the sized exports in the Export menu", () => {
    renderWithUndo();
    fireEvent.click(screen.getByRole("button", { name: "Save image" }));
    const menu = screen.getByRole("menu");
    for (const name of [/Phone wallpaper/, /Desktop wallpaper/, /Square print/]) {
      expect(within(menu).getByRole("menuitem", { name })).toBeTruthy();
    }
  });
});

describe("RecordGrid pins and undo", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("resets undo when the pins change, not when the grid first shows", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    );
    const onPinsChange = vi.fn();
    render(
      <RecordGrid
        username="someone"
        albums={albums}
        onAlbumsReorder={vi.fn()}
        onPinsChange={onPinsChange}
      />
    );
    expect(onPinsChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Pin Album 1" }));
    expect(onPinsChange).toHaveBeenCalledTimes(1);
  });
});
