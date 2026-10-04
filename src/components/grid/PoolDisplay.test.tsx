import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PoolDisplay } from "./PoolDisplay";
import { Album } from "@/types";

const albums: Album[] = [
  { id: 1, title: "Blonde", artist: "Frank Ocean", year: "2016" },
  { id: 2, title: "Lemonade", artist: "Beyoncé", year: "2016" },
  { id: 3, title: "Abbey Road", artist: "The Beatles", year: "1969" },
];

function renderPool(list = albums) {
  render(<PoolDisplay albums={list} onSelect={vi.fn()} moveSourceId={null} showAlbumLabels />);
}

const search = () => screen.getByRole("searchbox", { name: "Search the record pool" });
const type = (text: string) => fireEvent.change(search(), { target: { value: text } });

describe("PoolDisplay search", () => {
  afterEach(cleanup);

  it("shows every album and the full count before anything is typed", () => {
    renderPool();
    expect(screen.getByText("3 albums")).toBeTruthy();
    expect(screen.getAllByRole("img")).toHaveLength(3);
  });

  it("narrows the pool and the count as the user types", () => {
    renderPool();
    type("2016");
    expect(screen.getByText("2 of 3 albums")).toBeTruthy();
    expect(screen.queryByAltText("Abbey Road")).toBeNull();
    expect(screen.getByAltText("Blonde")).toBeTruthy();
    expect(screen.getByAltText("Lemonade")).toBeTruthy();
  });

  it("finds an album by artist ignoring accents", () => {
    renderPool();
    type("beyonce");
    expect(screen.getByAltText("Lemonade")).toBeTruthy();
    expect(screen.queryByAltText("Blonde")).toBeNull();
  });

  it("restores the whole pool when the search is cleared", () => {
    renderPool();
    type("abbey");
    expect(screen.getByText("1 of 3 albums")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect((search() as HTMLInputElement).value).toBe("");
    expect(screen.getByText("3 albums")).toBeTruthy();
    expect(screen.getAllByRole("img")).toHaveLength(3);
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
  });

  it("says when nothing matches", () => {
    renderPool();
    type("zzz");
    expect(screen.getByText(/No albums match/)).toBeTruthy();
    expect(screen.getByText("0 of 3 albums")).toBeTruthy();
  });

  it("renders nothing when the pool is empty", () => {
    renderPool([]);
    expect(screen.queryByRole("searchbox")).toBeNull();
  });
});
