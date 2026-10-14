import { expect, test } from "@playwright/test";
import { loadWall } from "./support";

test("marking the wall as hung remembers when each record was up", async ({ page }) => {
  await loadWall(page);
  await page.getByRole("button", { name: "Layouts" }).click();
  await page.getByRole("button", { name: "I hung the current wall" }).click();
  await expect(page.getByText("Marked the current wall as hung today.")).toBeVisible();
  await expect(page.getByText(/1 wall remembered/)).toBeVisible();

  // A record on the wall says when it was last up; one in the pool says it has not been.
  await page.locator("[data-album-id]").first().click();
  await expect(page.getByRole("dialog").getByText(/^Last on the wall /)).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("switch", { name: "Not hung recently first" })).toBeVisible();

  // The history is kept in this browser.
  await page.reload();
  await page.getByLabel("Discogs username").fill("someone");
  await page.getByRole("button", { name: "Load Collection" }).click();
  await page.getByRole("button", { name: "Layouts" }).click();
  await expect(page.getByText(/1 wall remembered/)).toBeVisible();
});
