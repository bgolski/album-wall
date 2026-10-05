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
    onToggleDimensionsConfig: vi.fn(),
    onTogglePinAll: vi.fn(),
    onToggleAlbumLabels: vi.fn(),
    onShuffle: vi.fn(),
    onToggleExportDropdown: vi.fn(),
    showDimensionsConfig: false,
    ...overrides,
  };
  return { props, ...render(<GridControls {...props} />) };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("GridControls", () => {
  it("groups the sort buttons under the Sort Records heading", () => {
    renderControls();
    const group = screen.getByRole("group", { name: "Sort Records" });
    expect(
      within(group)
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual(["Custom Order", "Sort by Artist", "Sort by Genre"]);
  });

  it.each([
    ["none", "Custom Order"],
    ["artist", "Sort by Artist"],
    ["genre", "Sort by Genre"],
  ] as const)("marks the %s sort as pressed and the others as not pressed", (option, label) => {
    renderControls({ sortOption: option });
    const group = screen.getByRole("group", { name: "Sort Records" });
    for (const button of within(group).getAllByRole("button")) {
      expect(button.getAttribute("aria-pressed")).toBe(
        button.textContent === label ? "true" : "false"
      );
    }
  });

  it("calls onSortChange with the option of the clicked sort button", () => {
    const { props } = renderControls();
    fireEvent.click(screen.getByRole("button", { name: "Sort by Genre" }));
    fireEvent.click(screen.getByRole("button", { name: "Sort by Artist" }));
    fireEvent.click(screen.getByRole("button", { name: "Custom Order" }));
    expect(vi.mocked(props.onSortChange).mock.calls).toEqual([["genre"], ["artist"], ["none"]]);
  });

  it("says whether the grid settings panel is open", () => {
    const { props, rerender } = renderControls();
    expect(
      screen.getByRole("button", { name: "Configure Grid" }).getAttribute("aria-expanded")
    ).toBe("false");
    rerender(<GridControls {...props} showDimensionsConfig />);
    expect(
      screen.getByRole("button", { name: "Hide Grid Config" }).getAttribute("aria-expanded")
    ).toBe("true");
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
    fireEvent.click(screen.getByRole("button", { name: "Configure Grid" }));
    fireEvent.click(screen.getByRole("button", { name: "Pin All" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide Labels" }));
    fireEvent.click(screen.getByRole("button", { name: "Shuffle" }));
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(props.onToggleDimensionsConfig).toHaveBeenCalledTimes(1);
    expect(props.onTogglePinAll).toHaveBeenCalledTimes(1);
    expect(props.onToggleAlbumLabels).toHaveBeenCalledTimes(1);
    expect(props.onShuffle).toHaveBeenCalledTimes(1);
    expect(props.onToggleExportDropdown).toHaveBeenCalledTimes(1);
  });

  it("disables Shuffle when every album is pinned", () => {
    renderControls({ areAllPinned: true });
    expect(screen.getByRole("button", { name: "Shuffle" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Unpin All" })).toHaveProperty("disabled", false);
  });
});
