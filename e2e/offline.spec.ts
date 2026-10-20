import { expect, test } from "@playwright/test";
import { stubNetwork } from "./support";

// With the service worker allowed, a visitor who has loaded the app once can come back with no
// connection.
test.use({ serviceWorkers: "allow" });

test("the app opens again with no connection after one visit", async ({ page, context }) => {
  await page.addInitScript(() => localStorage.setItem("album-wall:welcome-dismissed", "1"));
  await page.goto("./");
  await expect(page.getByRole("button", { name: "Load Collection" })).toBeVisible();
  // Wait for the worker to take control and keep the page.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).length > 0)).toBe(true);
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const cache = await caches.open("album-wall-pages-v1");
        return (await cache.keys()).length;
      })
    )
    .toBeGreaterThan(0);

  await expect
    .poll(() =>
      page.evaluate(async () => {
        const cache = await caches.open("album-wall-files-v1");
        const kept = (await cache.keys()).map((request) => request.url);
        // The demo's list, and the page's own scripts handed over once it had loaded.
        return (
          kept.some((url) => url.endsWith("/demo/collection.json")) &&
          kept.filter((url) => url.endsWith(".js")).length >= 5
        );
      })
    )
    .toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "Load Collection" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try the demo wall" })).toBeVisible();
});

test("a signed-in request is never kept", async ({ page }) => {
  await stubNetwork(page);
  await page.goto("./");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  const kept = await page.evaluate(async () => {
    const names = await caches.keys();
    const urls: string[] = [];
    for (const name of names) {
      for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
    }
    return urls;
  });
  expect(kept.some((url) => /discogs-proxy/.test(url))).toBe(false);
});
