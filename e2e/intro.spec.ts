import { expect, test } from "@playwright/test";

// The record's spin-up plays on the first load of a visit, and never for anyone who prefers less
// motion.
const introOn = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.hasAttribute("data-intro"));

test.describe("with motion", () => {
  test.use({ reducedMotion: "no-preference" });

  test("plays on the first load of a visit only", async ({ page }) => {
    await page.goto("./");
    expect(await introOn(page)).toBe(true);
    // The page itself is never held back: it is there and usable straight away.
    await expect(page.getByRole("button", { name: "Sign in with Discogs" })).toBeVisible();
    await page.reload();
    expect(await introOn(page)).toBe(false);
  });

  test("the welcome waits for the intro, then appears", async ({ page }) => {
    await page.goto("./");
    const welcome = page.getByRole("region", { name: "New to Album Wall?" });
    await expect(welcome).toBeHidden();
    await expect(welcome).toBeVisible({ timeout: 6000 });
  });
});

test.describe("when it should not play", () => {
  test.describe("with reduced motion", () => {
    test.use({ reducedMotion: "reduce" });
    test("stays off", async ({ page }) => {
      await page.goto("./");
      expect(await introOn(page)).toBe(false);
    });
  });
});

// A phone gets the same moment, but the record does not stay behind the page: scrolling is
// smoothest with nothing painted there.
test.describe("on a phone", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: "no-preference",
  });

  test("plays the first time, then the record is gone", async ({ page }) => {
    await page.goto("./");
    expect(await introOn(page)).toBe(true);
    await expect(page.getByRole("button", { name: "Sign in with Discogs" })).toBeVisible();
    await expect
      .poll(
        () =>
          page.evaluate(
            () => getComputedStyle(document.querySelector(".record-backdrop")!).visibility
          ),
        { timeout: 6000 }
      )
      .toBe("hidden");
    await page.reload();
    expect(await introOn(page)).toBe(false);
    expect(
      await page.evaluate(
        () => getComputedStyle(document.querySelector(".record-backdrop")!).display
      )
    ).toBe("none");
  });
});
