import { expect, test } from "@playwright/test";
import { albums, IMAGE_SERVICE, PIXEL, stubNetwork } from "./support";

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

test("Discogs covers come from the app's image service, so a saved wall includes every cover even with the proxy down", async ({
  page,
}) => {
  await stubNetwork(page);
  const discogsAlbums = albums.map((album) => ({
    ...album,
    cover_image: `https://i.discogs.com/cover/R-${album.id}-1.jpeg`,
    coverUrl: `https://i.discogs.com/cover/R-${album.id}-1.jpeg`,
  }));
  await page.route(
    (url) => url.searchParams.has("username"),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ username: "someone", albums: discogsAlbums }),
      })
  );
  await page.route(/images\.weserv\.nl/, (route) => route.abort());
  // Like Discogs, without a CORS header: a cover loaded from here could not go into a saved image.
  await page.route(/i\.discogs\.com/, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: PIXEL })
  );
  const serviceRequests: string[] = [];
  page.on("request", (request) => {
    if (IMAGE_SERVICE.test(request.url())) serviceRequests.push(request.url());
  });

  await page.goto("./");
  await page.getByLabel("Discogs username").fill("someone");
  await page.getByRole("button", { name: "Load Collection" }).click();
  const firstCover = page.locator("[data-album-id] img").first();
  await expect(firstCover).toHaveAttribute("src", IMAGE_SERVICE);
  await expect(page.getByText(/loading directly/)).toHaveCount(0);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export/ }).click();
  await page.getByRole("menuitem", { name: "Share or Save Image" }).click();
  await download;
  await expect(page.getByText("Image saved.", { exact: true })).toBeVisible();
  expect(serviceRequests.some((url) => url.endsWith("&w=600"))).toBe(true);
});
