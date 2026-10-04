import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CollectionManager } from "./CollectionManager";

const baseProps = {
  albums: [],
  username: "someone",
  loadedUsername: "",
  sharedWallState: null,
  isPending: false,
  error: null,
  onAlbumsReorder: vi.fn(),
  onRetry: vi.fn(),
};

describe("CollectionManager empty collection", () => {
  afterEach(cleanup);

  it("says the user has no records once an empty collection has loaded", () => {
    render(<CollectionManager {...baseProps} loadedUsername="someone" />);
    expect(screen.getByText("No records yet")).toBeTruthy();
    expect(screen.getByText(/someone has no records in their Discogs collection/)).toBeTruthy();
  });

  it("shows nothing before any collection has been loaded", () => {
    render(<CollectionManager {...baseProps} />);
    expect(screen.queryByText("No records yet")).toBeNull();
  });

  it("shows the error instead of the empty message when loading fails", () => {
    render(<CollectionManager {...baseProps} loadedUsername="someone" error="Boom" />);
    expect(screen.queryByText("No records yet")).toBeNull();
    expect(screen.getByText("Boom")).toBeTruthy();
  });
});
