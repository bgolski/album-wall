import { expect, type Page } from "@playwright/test";

// A tiny valid PNG, so cover images load without reaching the network.
export const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

/** Requests to the app's own cover image service. */
export const IMAGE_SERVICE = /albumwall\.bradleygolski\.com\/img\?/;

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
  // Most checks are about a returning visitor, so the first-visit welcome is already dismissed.
  await page.addInitScript(() => localStorage.setItem("album-wall:welcome-dismissed", "1"));
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
  // No short links unless a test serves one: sharing falls back to the long link.
  await page.route(
    (url) => url.pathname.endsWith("/share"),
    (route) => route.fulfill({ status: 404, contentType: "application/json", body: "{}" })
  );
  await page.route(/images\.weserv\.nl/, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: PIXEL })
  );
  await page.route(IMAGE_SERVICE, (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: PIXEL,
    })
  );
}

export async function loadWall(page: Page) {
  await stubNetwork(page);
  await page.goto("./");
  await page.getByLabel("Discogs username").fill("someone");
  await page.getByRole("button", { name: "Load Collection" }).click();
  await expect(page.locator("[data-album-id]").first()).toBeVisible();
}
