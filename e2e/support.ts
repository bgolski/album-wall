import { expect, type Page } from "@playwright/test";

// A tiny valid PNG, so cover images load without reaching the network.
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

export const albums = Array.from({ length: 40 }, (_, index) => ({
  id: index + 1,
  title: `Album ${index + 1}`,
  cover_image: `https://example.test/cover-${index + 1}.jpg`,
  coverUrl: `https://example.test/cover-${index + 1}.jpg`,
  discogsUrl: `https://www.discogs.com/release/${index + 1}`,
  artist: `Artist ${index + 1}`,
  genre: ["Rock"],
  year: "1999",
}));

export async function stubNetwork(page: Page) {
  await page.route(
    (url) => url.searchParams.has("username"),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ username: "someone", albums }),
      })
  );
  await page.route(/\.(jpg|jpeg|png|webp)(\?.*)?$/, (route) => {
    if (route.request().url().includes("localhost")) return route.continue();
    return route.fulfill({ status: 200, contentType: "image/png", body: PIXEL });
  });
  await page.route(/images\.weserv\.nl/, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: PIXEL })
  );
}

export async function loadWall(page: Page) {
  await stubNetwork(page);
  await page.goto("./");
  await page.getByLabel("Discogs username").fill("someone");
  await page.getByRole("button", { name: "Load Collection" }).click();
  await expect(page.locator("[data-album-id]").first()).toBeVisible();
}
