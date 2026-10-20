import { expect, test } from "@playwright/test";
import { loadWall } from "./support";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

const SHORT = "https://d111.cloudfront.net/w/AbCd1234";

test("copies a short link made when the export menu opens", async ({ page }) => {
  await loadWall(page);
  const requests: unknown[] = [];
  await page.route(
    (url) => url.pathname.endsWith("/share"),
    async (route) => {
      requests.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ url: SHORT }),
      });
    }
  );

  await page.getByRole("button", { name: "Share link" }).hover();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0]).toMatchObject({ title: "someone\x27s Album Wall", rows: expect.any(Number) });
  await page.getByRole("button", { name: "Share link" }).click();
  await expect(page.getByText("Link copied")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(SHORT);

  // The same wall again reuses the link instead of asking for another.
  await page.getByRole("button", { name: "Share link" }).click();
  expect(requests).toHaveLength(1);
});

test("copies the long link when no short link can be made", async ({ page }) => {
  await loadWall(page);
  await page.getByRole("button", { name: "Share link" }).click();
  await expect(page.getByText("Link copied")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("#share=");
});
