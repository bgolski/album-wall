import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AlbumWallApp from "./AlbumWallApp";
import { getUserCollection } from "@/utils/discogs";
import { encodeSharedWallState } from "@/utils/shareState";
import { Album } from "@/types";

vi.mock("@/utils/discogs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/discogs")>()),
  getUserCollection: vi.fn(),
}));

const collection = (count: number): Album[] =>
  Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    title: `Album ${index + 1}`,
    artist: `Artist ${index + 1}`,
  }));

const wallIds = () =>
  Array.from(document.querySelectorAll("#grid-container [data-album-id]")).map((tile) =>
    Number(tile.getAttribute("data-album-id"))
  );

const poolIds = () =>
  Array.from(document.querySelectorAll("[data-album-id]"))
    .filter((tile) => !tile.closest("#grid-container"))
    .map((tile) => Number(tile.getAttribute("data-album-id")));

const pinnedIds = () =>
  Array.from(document.querySelectorAll('#grid-container [data-pinned="true"]')).map((tile) =>
    Number(tile.getAttribute("data-album-id"))
  );

async function loadByHand(count: number) {
  vi.mocked(getUserCollection).mockResolvedValue(collection(count));
  render(<AlbumWallApp />);
  fireEvent.change(screen.getByLabelText("Discogs username"), { target: { value: "someone" } });
  fireEvent.click(screen.getByRole("button", { name: "Load Collection" }));
  await waitFor(() => expect(document.querySelector("#grid-container")).not.toBeNull());
}

describe("loading a shared wall link", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    );
  });

  afterEach(() => {
    cleanup();
    window.location.hash = "";
    vi.unstubAllGlobals();
    vi.mocked(getUserCollection).mockReset();
  });

  it("restores the shared order, pins, dimensions and username", async () => {
    window.location.hash = `#share=${encodeSharedWallState({
      v: 1,
      username: "someone",
      rows: 2,
      columns: 3,
      wallAlbumIds: ["5", "3", "9", "1", "12", "7"],
      pinnedAlbumIds: ["3", "7"],
    })}`;
    vi.mocked(getUserCollection).mockResolvedValue(collection(12));
    render(<AlbumWallApp />);

    await waitFor(() => expect(wallIds()).toEqual([5, 3, 9, 1, 12, 7]));
    expect(pinnedIds().sort((a, b) => a - b)).toEqual([3, 7]);
    expect(poolIds()).toEqual([2, 4, 6, 8, 10, 11]);
    expect(
      (document.querySelector("#grid-container") as HTMLElement).style.gridTemplateColumns
    ).toContain("repeat(3");
    expect(screen.getByRole("link", { name: "someone" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Load another collection" }));
    expect((screen.getByLabelText("Discogs username") as HTMLInputElement).value).toBe("someone");
    expect(getUserCollection).toHaveBeenCalledTimes(1);
  });

  it("folds the username form into one line once the wall shows, and opens it again", async () => {
    await loadByHand(5);
    expect(screen.queryByLabelText("Discogs username")).toBeNull();
    expect(screen.queryByText(/Enter your Discogs username/)).toBeNull();
    expect(screen.getByText(/5 albums/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Load another collection" }));
    expect(screen.getByLabelText("Discogs username")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Load Collection" }));
    await waitFor(() => expect(screen.queryByLabelText("Discogs username")).toBeNull());
  });

  it("ignores shared albums that are no longer in the collection", async () => {
    window.location.hash = `#share=${encodeSharedWallState({
      v: 1,
      username: "someone",
      rows: 1,
      columns: 3,
      wallAlbumIds: ["99", "2", "1"],
      pinnedAlbumIds: [],
    })}`;
    vi.mocked(getUserCollection).mockResolvedValue(collection(5));
    render(<AlbumWallApp />);

    await waitFor(() => expect(wallIds()).toEqual([2, 1, 3]));
    expect(poolIds()).toEqual([4, 5]);
  });

  it("loads without a share link in the collection's own order", async () => {
    await loadByHand(40);
    expect(wallIds()).toEqual(Array.from({ length: 32 }, (_, index) => index + 1));
    expect(poolIds()).toEqual([33, 34, 35, 36, 37, 38, 39, 40]);
    expect(pinnedIds()).toEqual([]);
  });
});

describe("changing the wall size", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.mocked(getUserCollection).mockReset();
  });

  const setRows = (rows: number) =>
    fireEvent.change(screen.getByLabelText("Rows:"), { target: { value: String(rows) } });

  it("moves albums between the wall and the pool and unpins the ones that leave", async () => {
    await loadByHand(40);
    fireEvent.click(screen.getByRole("button", { name: "Pin Album 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Pin Album 20" }));
    fireEvent.click(screen.getByRole("button", { name: "Wall size" }));

    setRows(2);
    await waitFor(() => expect(wallIds()).toHaveLength(16));
    expect(wallIds()).toEqual(Array.from({ length: 16 }, (_, index) => index + 1));
    expect(poolIds().slice(0, 3)).toEqual([17, 18, 19]);
    expect(poolIds()).toHaveLength(24);
    expect(pinnedIds()).toEqual([1]);

    setRows(4);
    await waitFor(() => expect(wallIds()).toHaveLength(32));
    expect(wallIds()).toEqual(Array.from({ length: 32 }, (_, index) => index + 1));
    expect(poolIds()).toEqual([33, 34, 35, 36, 37, 38, 39, 40]);
    expect(pinnedIds()).toEqual([1]);
  });

  it("keeps pins on albums that stay on the wall when it shrinks", async () => {
    await loadByHand(40);
    fireEvent.click(screen.getByRole("button", { name: "Pin Album 3" }));
    fireEvent.click(screen.getByRole("button", { name: "Wall size" }));
    setRows(3);
    await waitFor(() => expect(wallIds()).toHaveLength(24));
    expect(pinnedIds()).toEqual([3]);
  });

  it("restores the default size and unpins albums that leave the wall", async () => {
    await loadByHand(40);
    fireEvent.click(screen.getByRole("button", { name: "Wall size" }));
    setRows(5);
    await waitFor(() => expect(wallIds()).toHaveLength(40));
    fireEvent.click(screen.getByRole("button", { name: "Pin Album 40" }));
    expect(pinnedIds()).toEqual([40]);
    fireEvent.click(screen.getByRole("button", { name: /Reset/ }));
    await waitFor(() => expect(wallIds()).toHaveLength(32));
    expect(pinnedIds()).toEqual([]);
    expect(poolIds()).toEqual([33, 34, 35, 36, 37, 38, 39, 40]);
  });

  it("shows every album when the wall is larger than the collection", async () => {
    await loadByHand(10);
    fireEvent.click(screen.getByRole("button", { name: "Wall size" }));
    setRows(8);
    await waitFor(() => expect(wallIds()).toHaveLength(10));
    expect(wallIds()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(poolIds()).toEqual([]);
  });
});
