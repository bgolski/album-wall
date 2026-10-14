import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GradientPanel, describeBuild, type GradientBuildSummary } from "./GradientPanel";

afterEach(cleanup);

const summary: GradientBuildSummary = {
  match: "close",
  unmeasured: 0,
  artistConflicts: 0,
  keepArtistsApart: false,
  coversOfColor: null,
};

function panel(overrides: Partial<Parameters<typeof GradientPanel>[0]> = {}) {
  const onBuild = vi.fn().mockReturnValue(summary);
  render(
    <GradientPanel
      isVisible
      rows={2}
      columns={3}
      pending={0}
      total={10}
      onBuild={onBuild}
      {...overrides}
    />
  );
  return onBuild;
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const build = async () => {
  await act(async () => {
    click("Build wall");
  });
};
const swatches = () => screen.getAllByRole("button", { name: /^Color \d/ });

describe("GradientPanel", () => {
  it("shows nothing when closed", () => {
    const { container } = render(
      <GradientPanel
        isVisible={false}
        rows={2}
        columns={3}
        pending={0}
        total={0}
        onBuild={vi.fn()}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("builds the wall with the chosen colors, direction and artist rule", async () => {
    const onBuild = panel();
    click(/Sunset/);
    click("Top to bottom");
    fireEvent.click(screen.getByRole("switch"));
    await build();

    expect(onBuild).toHaveBeenCalledWith(
      { colors: ["#2b1055", "#d53369", "#fbb03b"], angle: 180 },
      true,
      false
    );
    expect(screen.getByRole("status").textContent).toMatch(/closely/);
    expect(screen.getByRole("button", { name: "Top to bottom" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
  });

  it("offers all eight directions", async () => {
    const onBuild = panel();
    for (const [name, angle] of [
      ["Toward top left", 315],
      ["Bottom to top", 0],
      ["Toward top right", 45],
      ["Right to left", 270],
      ["Left to right", 90],
      ["Toward bottom left", 225],
      ["Top to bottom", 180],
      ["Toward bottom right", 135],
    ] as const) {
      click(name);
      await build();
      expect(onBuild.mock.calls.at(-1)![0].angle).toBe(angle);
    }
  });

  it("edits a color picked from the swatches by its hex code, ignoring codes that are not colors", async () => {
    const onBuild = panel();
    click(/Black to white/);
    expect(screen.queryByLabelText(/hex code/)).toBeNull();

    fireEvent.click(swatches()[0]!);
    const hex = screen.getByLabelText("Color 1, hex code") as HTMLInputElement;
    expect(hex.value).toBe("#111111");
    fireEvent.change(hex, { target: { value: "#12" } });
    expect(hex.getAttribute("aria-invalid")).toBe("true");
    fireEvent.change(hex, { target: { value: "#ABCDEF" } });
    await build();
    expect(onBuild.mock.calls[0]![0].colors).toEqual(["#abcdef", "#f5f5f5"]);
  });

  it("adds a third color, opens it for editing, and removes it again", () => {
    panel();
    click(/Black to white/);
    click("Add a color");
    expect(swatches()).toHaveLength(3);
    expect(screen.getByLabelText("Color 3, hex code")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add a color" })).toBeNull();

    fireEvent.click(swatches()[1]!);
    click("Remove");
    expect(swatches().map((swatch) => swatch.getAttribute("aria-label"))).toEqual([
      "Color 1, #111111",
      "Color 2, #f5f5f5",
    ]);
  });

  it("does not offer Remove with only two colors", () => {
    panel();
    click(/Black to white/);
    fireEvent.click(swatches()[0]!);
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  });

  it("starts from a single color", async () => {
    const onBuild = panel();
    click("All blue");
    await build();
    expect(onBuild.mock.calls[0]![0].colors).toEqual(["#1976d2", "#1976d2"]);
  });

  it("previews the wall with one cell per spot", () => {
    const { container } = render(
      <GradientPanel isVisible rows={4} columns={8} pending={0} total={0} onBuild={vi.fn()} />
    );
    expect(container.querySelectorAll("figure span")).toHaveLength(32);
    expect(screen.getByText("What each spot on your 8 × 4 wall aims for")).toBeTruthy();
  });

  it("waits for the cover colors before building, and says how far along they are", () => {
    panel({ pending: 4, total: 10 });
    expect((screen.getByRole("button", { name: "Build wall" }) as HTMLButtonElement).disabled).toBe(
      true
    );
    expect(screen.getByRole("status").textContent).toBe("Reading cover colors... 6 of 10");
  });
});

describe("describeBuild", () => {
  it("says how closely the wall matches", () => {
    expect(describeBuild({ ...summary, match: "fair" })).toMatch(/fairly well/);
    expect(describeBuild({ ...summary, match: "loose" })).toMatch(/few covers in these colors/);
  });

  it("names how many covers are the color when a one-color wall matches loosely", () => {
    expect(describeBuild({ ...summary, match: "loose", coversOfColor: 2 })).toMatch(
      /only 2 of your covers are close to this color/
    );
    expect(describeBuild({ ...summary, match: "loose", coversOfColor: 0 })).toMatch(
      /none of your covers are close to this color/
    );
  });

  it("mentions covers with no readable color and same-artist pairs it could not separate", () => {
    const text = describeBuild({
      ...summary,
      unmeasured: 1,
      artistConflicts: 2,
      keepArtistsApart: true,
    });
    expect(text).toMatch(/1 cover has no readable color and was only used/);
    expect(text).toMatch(/2 pairs of covers by the same artist still touch/);
  });

  it("says nothing about artists when the rule is off", () => {
    expect(describeBuild({ ...summary, artistConflicts: 2 })).not.toMatch(/artist/);
  });
});

describe("GradientPanel suggestions", () => {
  it("offers gradients suggested for the collection, with a sentence about its colors", async () => {
    const onBuild = panel({
      suggestions: [
        { colors: ["#2b2826", "#d6d1c5"], angle: 90, names: ["black", "white"] },
        { colors: ["#2b2826", "#a55b59", "#d6d1c5"], angle: 90, names: ["black", "red", "white"] },
      ],
      summary: "Mostly black, gray and white covers, with some reds and browns.",
    });
    expect(
      screen.getByText("Mostly black, gray and white covers, with some reds and browns.")
    ).toBeTruthy();
    click("Black → red → white");
    await build();
    expect(onBuild.mock.calls[0]![0].colors).toEqual(["#2b2826", "#a55b59", "#d6d1c5"]);
  });

  it("leaves the row out until there are suggestions", () => {
    panel();
    expect(screen.queryByText("Suggested for your collection")).toBeNull();
  });
});

describe("GradientPanel and wall history", () => {
  it("offers preferring records not hung recently only when there is history", async () => {
    const onBuild = panel({ canPreferRested: true });
    fireEvent.click(screen.getByRole("switch", { name: "Prefer records not hung recently" }));
    await build();
    expect(onBuild.mock.calls[0]![2]).toBe(true);
    cleanup();
    panel();
    expect(screen.queryByRole("switch", { name: "Prefer records not hung recently" })).toBeNull();
  });
});
