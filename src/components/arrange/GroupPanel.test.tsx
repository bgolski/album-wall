import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GroupChoices, describeGroupBuild } from "./GroupPanel";

afterEach(cleanup);

const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

function setup(props: Partial<React.ComponentProps<typeof GroupChoices>> = {}) {
  const onBuild = vi.fn().mockReturnValue({ others: 0 });
  const onNotice = vi.fn();
  render(
    <GroupChoices
      mode="genre"
      choices={[
        { label: "Rock", count: 5 },
        { label: "Jazz", count: 4 },
      ]}
      onBuild={onBuild}
      onNotice={onNotice}
      {...props}
    />
  );
  return { onBuild, onNotice };
}

describe("describeGroupBuild", () => {
  it("says only that the wall was built when nothing needs mentioning", () => {
    expect(describeGroupBuild({ others: 0 })).toBe("Wall built");
  });

  it("mentions spots filled with other records", () => {
    expect(describeGroupBuild({ others: 1 })).toBe("Wall built, 1 spot filled with other records");
    expect(describeGroupBuild({ others: 3 })).toBe("Wall built, 3 spots filled with other records");
  });
});

describe("GroupChoices", () => {
  it("builds a wall of one genre in one tap and shows a notice", () => {
    const { onBuild, onNotice } = setup();
    click("Jazz");
    expect(onBuild).toHaveBeenCalledWith({ mode: "genre", groups: ["Jazz"], aToZ: false });
    expect(onNotice).toHaveBeenCalledWith("Wall built");
  });

  it("builds a wall that runs through every genre", () => {
    const { onBuild } = setup();
    click("All genres");
    expect(onBuild.mock.calls[0]![0].groups).toEqual(["Rock", "Jazz"]);
  });

  it("offers the biggest eight genres and styles only", () => {
    setup({
      choices: Array.from({ length: 12 }, (_, at) => ({ label: `G${at}`, count: 20 - at })),
    });
    expect(screen.getAllByRole("button")).toHaveLength(9);
  });

  it("builds by year, oldest first, newest first, or one decade", () => {
    const { onBuild } = setup({
      mode: "year",
      choices: [
        { label: "1960s", count: 3 },
        { label: "1970s", count: 4 },
      ],
    });
    click("Newest first");
    expect(onBuild.mock.calls[0]![0].groups).toEqual(["1970s", "1960s"]);
    click("Oldest first");
    expect(onBuild.mock.calls[1]![0].groups).toEqual(["1960s", "1970s"]);
    click("1970s");
    expect(onBuild.mock.calls[2]![0].groups).toEqual(["1970s"]);
  });

  it("offers A to Z and the artists with several records for artist", () => {
    const { onBuild } = setup({
      mode: "artist",
      choices: [
        { label: "Ash", count: 5 },
        { label: "Bee", count: 2 },
        { label: "Cat", count: 1 },
      ],
    });
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "A to Z",
      "Ash",
      "Bee",
    ]);
    click("A to Z");
    expect(onBuild).toHaveBeenCalledWith({ mode: "artist", groups: [], aToZ: true });
    click("Bee");
    expect(onBuild).toHaveBeenLastCalledWith({ mode: "artist", groups: ["Bee"], aToZ: false });
  });
});
