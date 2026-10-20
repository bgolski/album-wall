import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Album } from "@/types";
import { ExportPanel } from "./ExportPanel";

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("dark");
});

const albums = Array.from({ length: 8 }, (_, index) => ({
  id: index + 1,
  title: `Album ${index + 1}`,
  artist: "Artist",
  cover_image: `https://example.test/${index + 1}.jpg`,
})) as Album[];

function renderPanel(overrides: Partial<Parameters<typeof ExportPanel>[0]> = {}) {
  const onSaveImage = vi.fn();
  const onSaveGuide = vi.fn();
  const onSavePoster = vi.fn();
  render(
    <ExportPanel
      isVisible
      albums={albums}
      rows={2}
      columns={4}
      isExporting={false}
      onSaveImage={onSaveImage}
      onSaveGuide={onSaveGuide}
      onSavePoster={onSavePoster}
      {...overrides}
    />
  );
  return { onSaveImage, onSaveGuide, onSavePoster };
}

describe("ExportPanel", () => {
  it("lists what can be made, with a preview of it", () => {
    renderPanel();
    const choices = screen.getByRole("group", { name: "Export as" });
    expect(Array.from(choices.querySelectorAll("button")).map((b) => b.textContent)).toEqual([
      "Wall",
      "Phone",
      "Desktop",
      "Poster",
      "Guide",
    ]);
    expect(screen.getByTestId("export-preview").querySelectorAll("img")).toHaveLength(8);
  });

  it("saves the chosen size on the chosen background", () => {
    const { onSaveImage } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Desktop" }));
    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSaveImage).toHaveBeenCalledWith(
      expect.objectContaining({ id: "desktop", width: 2560, height: 1440 }),
      { color: "#f1f3f9", record: false }
    );
  });

  it("saves the wall by itself when Wall is chosen", () => {
    const { onSaveImage } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Wall" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSaveImage).toHaveBeenCalledWith(undefined, expect.objectContaining({ record: false }));
  });

  it("makes the guide, which has no background to choose", () => {
    const { onSaveImage, onSaveGuide } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Guide" }));
    expect(screen.queryByRole("group", { name: "Background" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSaveGuide).toHaveBeenCalledTimes(1);
    expect(onSaveImage).not.toHaveBeenCalled();
  });

  it("starts on the page's own light or dark colour until one is picked", () => {
    document.documentElement.classList.add("dark");
    const { onSaveImage } = renderPanel();
    expect(screen.getByRole("button", { name: "Dark" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSaveImage).toHaveBeenCalledWith(expect.anything(), {
      color: "#0b0f17",
      record: false,
    });
  });

  it("does not draw the preview while the panel is closed", () => {
    renderPanel({ isVisible: false });
    expect(screen.queryByTestId("export-preview")).toBeNull();
  });

  it("holds Save while a file is being made", () => {
    renderPanel({ isExporting: true });
    expect(screen.getByRole("button", { name: "Save" })).toHaveProperty("disabled", true);
  });

  it("offers the record behind a wallpaper, but not behind the wall by itself", () => {
    const { onSaveImage } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Record" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSaveImage).toHaveBeenLastCalledWith(expect.objectContaining({ id: "phone" }), {
      color: "#0b0f17",
      record: true,
    });

    fireEvent.click(screen.getByRole("button", { name: "Wall" }));
    expect(screen.queryByRole("button", { name: "Record" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSaveImage).toHaveBeenLastCalledWith(undefined, { color: "#0b0f17", record: false });
  });

  it("has a poster made at print size, in the size and on the background chosen", () => {
    const { onSavePoster, onSaveImage } = renderPanel();
    expect(screen.queryByRole("group", { name: "Poster size" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Poster" }));
    const sizes = screen.getByRole("group", { name: "Poster size" });
    expect(
      Array.from(sizes.querySelectorAll("button")).map((button) => button.textContent)
    ).toEqual(["18 × 24", "24 × 36"]);

    fireEvent.click(screen.getByRole("button", { name: "24 × 36" }));
    fireEvent.click(screen.getByRole("button", { name: "Record" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSavePoster).toHaveBeenCalledWith("24x36", "record");
    expect(onSaveImage).not.toHaveBeenCalled();
  });

  it("previews the poster upright for a tall wall and sideways for a wide one", () => {
    renderPanel({ rows: 4, columns: 2 });
    fireEvent.click(screen.getByRole("button", { name: "Poster" }));
    expect(screen.getByTestId("export-preview").style.aspectRatio).toMatch(/^0\.75|5400 \/ 7200/);
    cleanup();
    renderPanel({ rows: 2, columns: 6 });
    fireEvent.click(screen.getByRole("button", { name: "Poster" }));
    expect(screen.getByTestId("export-preview").style.aspectRatio).toMatch(/^1\.3|7200 \/ 5400/);
  });

  it("offers the steps from the wall hung last time on the guide, on by default, only when there are some", () => {
    const first = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Guide" }));
    expect(screen.queryByRole("button", { name: "Steps" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(first.onSaveGuide).toHaveBeenLastCalledWith(false);
    cleanup();

    const { onSaveGuide } = renderPanel({ stepCount: 5 });
    fireEvent.click(screen.getByRole("button", { name: "Guide" }));
    const steps = screen.getByRole("button", { name: "Steps" });
    expect(steps.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSaveGuide).toHaveBeenLastCalledWith(true);

    fireEvent.click(steps);
    expect(steps.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSaveGuide).toHaveBeenLastCalledWith(false);
  });
});
