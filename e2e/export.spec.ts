import { expect, test } from "@playwright/test";
import { loadWall } from "./support";

test("saving the wall as an image downloads a PNG", async ({ page }) => {
  await loadWall(page);
  await page.getByRole("button", { name: /Export/ }).click();

  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Share or Save Image" }).click();

  expect((await download).suggestedFilename()).toBe("someone_vinyl_wall.png");
  await expect(page.getByText("Image saved.")).toBeVisible();
});
