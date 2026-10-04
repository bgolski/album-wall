import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { RecordGrid } from "./RecordGrid";
import { Album } from "@/types";

const albums: Album[] = Array.from({ length: 40 }, (_, index) => ({
  id: index + 1,
  title: `Album ${index + 1}`,
  artist: `Artist ${index + 1}`,
}));

function renderGrid(onAlbumsReorder = vi.fn()) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
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
    fireEvent.click(screen.getByRole("button", { name: /^Move/ }));
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
    fireEvent.click(screen.getByRole("button", { name: /^Move/ }));
    fireEvent.click(tile("Album 40"));
    const order = onAlbumsReorder.mock.calls[0]![0].map((a: Album) => a.id);
    expect(order[0]).toBe(40);
    expect(order[39]).toBe(1);
  });

  it("cancels a move by tapping the same album or Cancel", () => {
    const onAlbumsReorder = renderGrid();
    fireEvent.click(tile("Album 1"));
    fireEvent.click(screen.getByRole("button", { name: /^Move/ }));
    fireEvent.click(tile("Album 1"));
    expect(screen.queryByTestId("move-banner")).toBeNull();

    fireEvent.click(tile("Album 1"));
    fireEvent.click(screen.getByRole("button", { name: /^Move/ }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByTestId("move-banner")).toBeNull();
    expect(onAlbumsReorder).not.toHaveBeenCalled();
  });

  it("refuses to swap with a pinned album and keeps the move going", () => {
    const onAlbumsReorder = renderGrid();
    fireEvent.click(screen.getByRole("button", { name: "Pin Album 2" }));
    fireEvent.click(tile("Album 1"));
    fireEvent.click(screen.getByRole("button", { name: /^Move/ }));
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
    const move = screen.getByRole("button", { name: /^Move/ }) as HTMLButtonElement;
    expect(move.disabled).toBe(true);
  });

  it("gives each unpinned tile a drag grip for touch", () => {
    renderGrid();
    expect(screen.getByRole("button", { name: "Drag Album 1" })).toBeTruthy();
  });

  it("offers Share Link only when the browser can share", () => {
    renderGrid();
    fireEvent.click(screen.getByRole("button", { name: /Export/ }));
    expect(screen.queryByRole("button", { name: "Share Link" })).toBeNull();
    cleanup();

    vi.stubGlobal("navigator", { ...navigator, share: vi.fn() });
    renderGrid();
    fireEvent.click(screen.getByRole("button", { name: /Export/ }));
    expect(screen.getByRole("button", { name: "Share Link" })).toBeTruthy();
  });

  it("shares the wall link through the share sheet", async () => {
    const share = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { ...navigator, share });
    renderGrid();
    fireEvent.click(screen.getByRole("button", { name: /Export/ }));
    fireEvent.click(screen.getByRole("button", { name: "Share Link" }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const [data] = share.mock.calls[0] as unknown as [{ url: string }];
    expect(data.url).toContain("#");
    expect(screen.queryByRole("button", { name: "Share Link" })).toBeNull();
  });

  it("shows the copy result as a toast and closes the menu", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    renderGrid();
    fireEvent.click(screen.getByRole("button", { name: /Export/ }));
    fireEvent.click(screen.getByRole("button", { name: "Copy Share Link" }));
    const line = await screen.findByText("Share link copied.");
    expect(line.closest("[role=status]")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Copy Share Link" })).toBeNull();
  });
});
