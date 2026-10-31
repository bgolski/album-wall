import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { GridControls } from "./GridControls";

type Props = ComponentProps<typeof GridControls>;

function renderControls(overrides: Partial<Props> = {}) {
  const props: Props = {
    sortOption: "none",
    areAllPinned: false,
    showAlbumLabels: true,
    onSortChange: vi.fn(),
    openPanel: null,
    onTogglePanel: vi.fn(),
    onTogglePinAll: vi.fn(),
    onToggleAlbumLabels: vi.fn(),
    onShuffle: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<GridControls {...props} />) };
}

describe("GridControls color sort", () => {
  afterEach(cleanup);

  it("offers Sort by Color and reports the choice", () => {
    const { props } = renderControls();
    fireEvent.click(screen.getByRole("button", { name: "Color" }));
    expect(props.onSortChange).toHaveBeenCalledWith("color");
  });

  it("marks Sort by Color as pressed when it is the active sort", () => {
    renderControls({ sortOption: "color" });
    expect(screen.getByRole("button", { name: "Color" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "By hand" }).getAttribute("aria-pressed")).toBe(
      "false"
    );
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("GridControls", () => {
  it("groups the ways to arrange the wall under the Arrange heading", () => {
    renderControls();
    const group = screen.getByRole("group", { name: "Arrange" });
    expect(
      within(group)
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual(["By hand", "Artist", "Genre", "Year", "Color", "Shuffle"]);
  });

  it.each([
    ["none", "By hand"],
    ["artist", "Artist"],
    ["genre", "Genre"],
    ["year", "Year"],
    ["color", "Color"],
  ] as const)("marks the %s sort as pressed and the others as not pressed", (option, label) => {
    renderControls({ sortOption: option });
    const group = screen.getByRole("group", { name: "Arrange" });
    const modes = within(group)
      .getAllByRole("button")
      .filter((button) => button.hasAttribute("aria-pressed"));
    expect(modes).toHaveLength(5);
    for (const button of modes) {
      expect(button.getAttribute("aria-pressed")).toBe(
        button.textContent === label ? "true" : "false"
      );
    }
  });

  it("calls onSortChange with the option of the clicked sort button", () => {
    const { props } = renderControls();
    fireEvent.click(screen.getByRole("button", { name: "Genre" }));
    fireEvent.click(screen.getByRole("button", { name: "Artist" }));
    fireEvent.click(screen.getByRole("button", { name: "By hand" }));
    expect(vi.mocked(props.onSortChange).mock.calls).toEqual([["genre"], ["artist"], ["none"]]);
  });

  it("says which panel is open", () => {
    const { props, rerender } = renderControls();
    const expanded = () =>
      ["Wall size", "Saved walls", "Export"].map((name) =>
        screen.getByRole("button", { name }).getAttribute("aria-expanded")
      );
    expect(expanded()).toEqual(["false", "false", "false"]);
    rerender(<GridControls {...props} openPanel="size" />);
    expect(expanded()).toEqual(["true", "false", "false"]);
    rerender(<GridControls {...props} openPanel="export" />);
    expect(expanded()).toEqual(["false", "false", "true"]);
  });

  it("hides the decorative icons from assistive technology", () => {
    const { container } = renderControls();
    const icons = container.querySelectorAll("svg");
    expect(icons.length).toBeGreaterThan(0);
    icons.forEach((icon) => expect(icon.getAttribute("aria-hidden")).toBe("true"));
  });

  it("gives every control type=button", () => {
    renderControls();
    for (const button of screen.getAllByRole("button")) {
      expect(button.getAttribute("type")).toBe("button");
    }
  });

  it("keeps the other actions wired up", () => {
    const { props } = renderControls();
    fireEvent.click(screen.getByRole("button", { name: "Wall size" }));
    fireEvent.click(screen.getByRole("button", { name: "Pin all" }));
    fireEvent.click(screen.getByRole("button", { name: "Labels" }));
    fireEvent.click(screen.getByRole("button", { name: "Shuffle" }));
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    fireEvent.click(screen.getByRole("button", { name: "Saved walls" }));
    expect(vi.mocked(props.onTogglePanel).mock.calls).toEqual([["size"], ["export"], ["layouts"]]);
    expect(props.onTogglePinAll).toHaveBeenCalledTimes(1);
    expect(props.onToggleAlbumLabels).toHaveBeenCalledTimes(1);
    expect(props.onShuffle).toHaveBeenCalledTimes(1);
  });

  it("shows Labels and Pin all as switches that keep their names", () => {
    const { props, rerender } = renderControls({ showAlbumLabels: false, areAllPinned: false });
    expect(screen.getByRole("button", { name: "Labels" }).getAttribute("aria-pressed")).toBe(
      "false"
    );
    expect(screen.getByRole("button", { name: "Pin all" }).getAttribute("aria-pressed")).toBe(
      "false"
    );
    rerender(<GridControls {...props} showAlbumLabels areAllPinned />);
    expect(screen.getByRole("button", { name: "Labels" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(screen.getByRole("button", { name: "Pin all" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
  });

  it("offers Share next to Saved walls and Export, and gets the link ready on approach", () => {
    const onShare = vi.fn();
    const onPrepareShare = vi.fn();
    renderControls({ onShare, onPrepareShare });
    const group = screen.getByRole("group", { name: "Save & share" });
    const share = within(group).getByRole("button", { name: "Share link" });
    fireEvent.focus(share);
    fireEvent.click(share);
    expect(onPrepareShare).toHaveBeenCalled();
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it("disables Shuffle when every album is pinned", () => {
    renderControls({ areAllPinned: true });
    expect(screen.getByRole("button", { name: "Shuffle" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Pin all" })).toHaveProperty("disabled", false);
  });
});

describe("GridControls undo", () => {
  it("disables Undo until there is something to undo", () => {
    renderControls();
    expect(screen.getByRole("button", { name: "Undo" })).toHaveProperty("disabled", true);
  });

  it("calls onUndo", () => {
    const { props } = renderControls({ canUndo: true, onUndo: vi.fn() });
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(props.onUndo).toHaveBeenCalledTimes(1);
  });
});
