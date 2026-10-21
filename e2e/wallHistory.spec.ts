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

test("an earlier wall can be looked at and put back from History", async ({ page }) => {
  await loadWall(page);
  // The whole order, since a shuffle can leave any one place as it was.
  const wallIds = () =>
    page
      .locator("#grid-container [data-album-id]")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-album-id")));
  const before = await wallIds();

  await page.getByRole("button", { name: "Saved walls" }).click();
  await expect(page.getByRole("heading", { name: "History" })).toHaveCount(0);
  await page.getByLabel("Name for the current wall").fill("Autumn");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "More for Autumn" }).click();
  await page.getByRole("menuitem", { name: "Mark as on my wall" }).click();

  // The wall it was hung as is listed, with its picture.
  await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
  const history = page.getByRole("list", { name: "History" });
  await history.getByRole("button", { expanded: false }).first().click();
  await expect(history.getByRole("img", { name: /32 albums/ })).toBeVisible();

  // Change the wall, then put the earlier one back.
  await page.getByRole("button", { name: "Shuffle" }).click();
  await expect.poll(wallIds).not.toEqual(before);
  await history.getByRole("button", { name: /^Use the wall from/ }).click();
  await expect.poll(wallIds).toEqual(before);
});
