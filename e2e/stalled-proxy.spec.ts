import { expect, test } from "@playwright/test";

test("a proxy that never answers ends in an error with a Try again button, not a spinner", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("album-wall:welcome-dismissed", "1"));
  await page.clock.install();
  // The request is held open and never answered.
  await page.route(
    (url) => url.searchParams.has("username"),
    () => {}
  );

  await page.goto("./");
  await page.getByLabel("Discogs username").fill("someone");
  await page.getByRole("button", { name: "Load Collection" }).click();
  await expect(page.getByText("Loading someone's collection")).toBeVisible();

  await page.clock.runFor(61_000);
  await expect(page.getByRole("heading", { name: "Discogs isn't answering" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByText("Loading someone's collection")).toHaveCount(0);
});
