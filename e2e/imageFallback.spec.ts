import { expect, test } from "@playwright/test";
import { stubNetwork } from "./support";

test("covers still show when the image proxy is down, and the wall can still be saved", async ({
  page,
}) => {
  await stubNetwork(page);
  // Registered last, so it wins over the stub's proxy handler: every proxy request fails.
  await page.route(/images\.weserv\.nl/, (route) => route.abort());

  await page.goto("./");
  await page.getByLabel("Discogs username").fill("someone");
  await page.getByRole("button", { name: "Load Collection" }).click();
  await expect(page.locator("[data-album-id]").first()).toBeVisible();

  await expect(page.getByText(/loading directly because the image service/)).toBeVisible();
  const firstCover = page.locator("[data-album-id] img").first();
  await expect(firstCover).toHaveAttribute("src", /^https:\/\/example\.test\//);
  await expect
    .poll(() =>
      firstCover.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)
    )
    .toBe(true);

  // Saving still works. (Which covers are left out depends on the browser refusing to read them,
  // which the stubbed network cannot reproduce; the drawing code is tested for that directly.)
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export/ }).click();
  await page.getByRole("menuitem", { name: "Share or Save Image" }).click();
  await download;
  await expect(page.getByText(/Image saved/)).toBeVisible();
});
