import { expect, test } from "@playwright/test";
import { loadWall } from "./support";

test("marking a saved layout as on the wall remembers when each record was up", async ({
  page,
}) => {
  await loadWall(page);
  await page.getByRole("button", { name: "Saved walls" }).click();
  await page.getByLabel("Name for the current wall").fill("Autumn");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "More for Autumn" }).click();
  await page.getByRole("menuitem", { name: "Mark as on my wall" }).click();
  await page.getByRole("button", { name: "More for Autumn" }).click();
  await expect(page.getByRole("menuitem", { name: "On my wall" })).toBeVisible();
  await page.keyboard.press("Escape");

  // A record on the wall says when it was last up.
  await page.locator("[data-album-id]").first().click();
  await expect(page.getByRole("dialog").getByText(/^Last on the wall /)).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();

  // Kept in this browser.
  // The address names the collection, so reloading opens it again.
  await page.reload();
  await expect(page.getByRole("link", { name: "someone" })).toBeVisible();
  await page.getByRole("button", { name: "Saved walls" }).click();
  await page.getByRole("button", { name: "More for Autumn" }).click();
  await expect(page.getByRole("menuitem", { name: "On my wall" })).toBeVisible();
  await page.keyboard.press("Escape");
});
