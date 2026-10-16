import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { stubNetwork } from "./support";

const demo = JSON.parse(readFileSync("public/demo/collection.json", "utf8")) as {
  albums: { id: number; artist: string; year?: string }[];
};
const yearOf = new Map(demo.albums.map((album) => [String(album.id), Number(album.year)]));
const artistOf = new Map(demo.albums.map((album) => [String(album.id), album.artist.trim()]));

const wallIds = (page: Page) =>
  page
    .locator("[data-album-id]")
    .evaluateAll((nodes) => nodes.slice(0, 32).map((node) => node.getAttribute("data-album-id")!));

const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

async function openDemo(page: Page) {
  await stubNetwork(page);
  await page.goto("./");
  await page.getByRole("button", { name: "Try the demo wall" }).click();
  await expect(page.locator("[data-album-id]").first()).toBeVisible();
}

test("Year builds a wall that runs through the decades, oldest on the left", async ({ page }) => {
  await openDemo(page);
  const before = await wallIds(page);

  await page.getByRole("button", { name: "Year", exact: true }).click();
  await expect(page.getByRole("group", { name: "Arrange by year" })).toBeVisible();
  // Opening the panel changes nothing on the wall.
  expect(await wallIds(page)).toEqual(before);

  await page.getByRole("button", { name: "Oldest first" }).click();
  const built = await wallIds(page);
  expect(built).not.toEqual(before);
  const column = (index: number) =>
    built.filter((_, at) => at % 8 === index).map((id) => yearOf.get(id)!);
  expect(average(column(0))).toBeLessThan(average(column(7)));

  await page.getByRole("button", { name: "Undo" }).click();
  expect(await wallIds(page)).toEqual(before);
});

test("Artist offers A to Z and Undo puts the wall back", async ({ page }) => {
  await openDemo(page);
  const before = await wallIds(page);

  await page.getByRole("button", { name: "Artist", exact: true }).click();
  expect(await wallIds(page)).toEqual(before);
  await page.getByRole("button", { name: "A to Z" }).click();
  const names = (await wallIds(page)).map((id) => artistOf.get(id)!);
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));

  await page.getByRole("button", { name: "Undo" }).click();
  expect(await wallIds(page)).toEqual(before);
});

test("Genre builds a wall of one genre in one tap", async ({ page }) => {
  await openDemo(page);
  await page.getByRole("button", { name: "Genre", exact: true }).click();
  await expect(page.getByRole("group", { name: "Arrange by genre" })).toBeVisible();
  const before = await wallIds(page);
  await page.getByRole("button", { name: "All genres" }).click();
  expect(await wallIds(page)).not.toEqual(before);
});

test("choosing Artist, Genre or Year does not change the width of the wall", async ({ page }) => {
  await openDemo(page);
  const width = () =>
    page
      .locator("[data-album-id]")
      .first()
      .evaluate((node) => node.clientWidth);
  const before = await width();
  for (const mode of ["Artist", "Genre", "Year"]) {
    await page.getByRole("button", { name: mode, exact: true }).click();
    expect(await width()).toBe(before);
  }
});
