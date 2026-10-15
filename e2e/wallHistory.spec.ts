import { expect, test } from "@playwright/test";
import { loadWall } from "./support";

test("marking a saved layout as on the wall remembers when each record was up", async ({
  page,
}) => {
  await loadWall(page);
  await page.getByRole("button", { name: "Layouts" }).click();
  await page.getByLabel("Name for the current wall").fill("Autumn");
  await page.getByRole("checkbox", { name: "It's on my wall now" }).check();
  await page.getByRole("button", { name: "Save current wall" }).click();
  await expect(page.getByText(`Saved "Autumn". It's on your wall.`)).toBeVisible();
  await expect(page.getByText(/On your wall since/)).toBeVisible();

  // A record on the wall says when it was last up; the pool can list rested records first.
  await page.locator("[data-album-id]").first().click();
  await expect(page.getByRole("dialog").getByText(/^Last on the wall /)).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Not hung recently first" })).toBeVisible();

  // Kept in this browser.
  await page.reload();
  await page.getByLabel("Discogs username").fill("someone");
  await page.getByRole("button", { name: "Load Collection" }).click();
  await page.getByRole("button", { name: "Layouts" }).click();
  await expect(page.getByText(/On your wall since/)).toBeVisible();
});
