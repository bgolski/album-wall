import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { sortAlbumsByColor } from "../src/utils/sortByColor";
import { stubNetwork } from "./support";

// The demo ships each cover's profile, so Sort by Color needs no measuring for the 32 on the wall.
const demo = JSON.parse(readFileSync("public/demo/collection.json", "utf8")) as {
  albums: {
    id: number;
    title: string;
    artist: string;
    profile?: { c: number[] };
  }[];
};

test("Sort by Color orders the demo wall by cover color without reading any pixels", async ({
  page,
}) => {
  await stubNetwork(page);
  const measuringRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("images.weserv.nl") && request.url().includes("w=32&")) {
      measuringRequests.push(request.url());
    }
  });

  await page.goto("./");
  await page.getByRole("button", { name: "Try the demo wall" }).click();
  await expect(page.locator("[data-album-id]").first()).toBeVisible();

  await page.getByRole("button", { name: "Sort by Color" }).click();
  await expect(page.getByRole("button", { name: "Sort by Color" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );

  const stored = demo.albums.slice(0, 32);
  const wall = stored.map(({ id, title, artist }) => ({ id, title, artist }));
  const colors = Object.fromEntries(
    stored.map((album) => {
      const c = album.profile?.c;
      return [String(album.id), c ? { l: c[0]!, a: c[1]!, b: c[2]! } : null];
    })
  );
  const expected = sortAlbumsByColor(wall, colors, (album) => String(album.id)).map((album) =>
    String(album.id)
  );
  const shown = await page
    .locator("[data-album-id]")
    .evaluateAll((nodes) => nodes.slice(0, 32).map((node) => node.getAttribute("data-album-id")));
  expect(shown).toEqual(expected);
  expect(shown).not.toEqual(wall.map((album) => String(album.id)));
  expect(measuringRequests).toEqual([]);

  await page.getByRole("button", { name: "Custom Order" }).click();
  const back = await page
    .locator("[data-album-id]")
    .evaluateAll((nodes) => nodes.slice(0, 32).map((node) => node.getAttribute("data-album-id")));
  expect(back).toEqual(wall.map((album) => String(album.id)));
});
