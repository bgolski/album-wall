import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Album, SharedWallState } from "@/types";
import { Rehang } from "./Rehang";

const albums = new Map<string, Album>(
  Array.from({ length: 6 }, (_, i) => [
    String(i + 1),
    { id: i + 1, title: `Album ${i + 1}`, artist: `Artist ${i + 1}` },
  ])
);

const wall = (ids: string[]): SharedWallState => ({
  v: 1,
  username: "someone",
  rows: 1,
  columns: ids.length,
  wallAlbumIds: ids,
  pinnedAlbumIds: [],
});

function setup(from: string[], to: string[]): { onFinish: () => void; onCancel: () => void } {
  const onFinish = vi.fn();
  const onCancel = vi.fn();
  render(
    <Rehang
      currentWall={wall(from)}
      target={wall(to)}
      name="Autumn"
      albumsById={albums}
      onCancel={onCancel}
      onFinish={onFinish}
    />
  );
  return { onFinish, onCancel };
}

const progress = () => screen.getByText(/^\d+ \/ \d+$/).textContent;
const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

afterEach(cleanup);

describe("Rehang", () => {
  it("shows one step at a time, with the cover to handle", () => {
    setup(["1", "2", "3"], ["4", "5", "6"]);
    expect(progress()).toBe("1 / 3");
    expect(screen.getByText("Replace")).toBeTruthy();
    // The cover coming down and the one going up, by title.
    expect(screen.getByText("Album 1")).toBeTruthy();
    expect(screen.getByText("Album 4")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe(
      "Replace Album 1 with Album 4 at row 1, column 1"
    );
    expect(screen.queryByText("Album 2")).toBeNull();
  });

  it("goes on with Done and back with Back", () => {
    setup(["1", "2", "3"], ["4", "5", "6"]);
    expect((screen.getByRole("button", { name: "Back" }) as HTMLButtonElement).disabled).toBe(true);
    click("Done");
    expect(progress()).toBe("2 / 3");
    expect(screen.getByText("Album 2")).toBeTruthy();
    click("Back");
    expect(progress()).toBe("1 / 3");
  });

  it("finishes when the last step is done, with no extra screen", () => {
    const { onFinish } = setup(["1", "2", "3"], ["4", "5", "6"]);
    click("Done");
    click("Done");
    expect(progress()).toBe("3 / 3");
    expect(onFinish).not.toHaveBeenCalled();
    click("Done");
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("img", { name: "All done" })).toBeNull();
  });

  it("names the verb of each kind of step", () => {
    // 1 and 2 swap, so one of them is set aside; 3 is hung where nothing was.
    setup(["1", "2"], ["2", "1", "3"]);
    const verbs: string[] = [];
    for (let i = 0; i < 4 && screen.queryByRole("status") !== null; i += 1) {
      verbs.push(screen.getByRole("status").textContent!.split(" ")[0]!);
      if (progress() === "4 / 4") break;
      click("Done");
    }
    expect(verbs).toContain("Set");
    expect(verbs).toContain("Move");
    expect(verbs).toContain("Hang");
  });

  it("can be cancelled at any step, from the X or with Escape, without finishing", () => {
    const { onCancel, onFinish } = setup(["1", "2", "3"], ["4", "5", "6"]);
    click("Done");
    click("Cancel");
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onFinish).not.toHaveBeenCalled();
  });
});
