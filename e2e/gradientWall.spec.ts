import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { IMAGE_SERVICE, stubNetwork } from "./support";

// The demo ships each cover's profile, so the gradient builder needs no measuring on it.
const demo = JSON.parse(readFileSync("public/demo/collection.json", "utf8")) as {
  albums: { id: number; artist: string }[];
};
const artistOf = new Map(
  demo.albums.map((album) => [String(album.id), album.artist.trim().toLowerCase()])
);

const wallIds = (page: Page) =>
  page
    .locator("[data-album-id]")
    .evaluateAll((nodes) => nodes.slice(0, 32).map((node) => node.getAttribute("data-album-id")!));

test("Sort by Color builds a wall for a gradient from the whole demo collection", async ({
  page,
}) => {
  await stubNetwork(page);
  const measuringRequests: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    const proxied = url.includes("images.weserv.nl") || IMAGE_SERVICE.test(url);
    if (proxied && /[?&]w=64(&|$)/.test(url)) {
      measuringRequests.push(request.url());
    }
  });

  await page.goto("./");
  await page.getByRole("button", { name: "Try the demo wall" }).click();
  await expect(page.locator("[data-album-id]").first()).toBeVisible();
  const before = await wallIds(page);

  await page.getByRole("button", { name: "Color" }).click();
  await expect(page.getByRole("heading", { name: "Sort by Color" })).toBeVisible();
  // Opening the builder changes nothing on the wall.
  expect(await wallIds(page)).toEqual(before);
  // The demo's colors are known, so it is offered gradients it can fill.
  await expect(page.getByText("Suggested for your collection")).toBeVisible();

  await page.getByRole("button", { name: /Rainbow/ }).click();
  await page.getByRole("button", { name: "Build wall" }).click();
  await expect(page.getByText(/^Built the wall/)).toBeVisible();
  const rainbow = await wallIds(page);
  expect(rainbow).not.toEqual(before);
  expect(measuringRequests).toEqual([]);

  // One Undo puts the previous wall back.
  await page.getByRole("button", { name: "Undo" }).click();
  expect(await wallIds(page)).toEqual(before);

  // With the artist rule on, no two covers by the same artist touch.
  await page.getByRole("switch", { name: /same artist/ }).check();
  await page.getByRole("button", { name: "Build wall" }).click();
  await expect(page.getByText(/^Built the wall/)).toBeVisible();
  const apart = await wallIds(page);
  const columns = 8;
  for (let index = 0; index < apart.length; index += 1) {
    const artist = artistOf.get(apart[index]!);
    if (index % columns < columns - 1 && index + 1 < apart.length) {
      expect(artistOf.get(apart[index + 1]!), `spots ${index} and ${index + 1}`).not.toBe(artist);
    }
    if (index + columns < apart.length) {
      expect(
        artistOf.get(apart[index + columns]!),
        `spots ${index} and ${index + columns}`
      ).not.toBe(artist);
    }
  }
});
