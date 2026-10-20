import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { loadWall, stubNetwork } from "./support";

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const summary = results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.help} — ${violation.nodes
        .slice(0, 3)
        .map((node) => node.target.join(" "))
        .join(" | ")}`
  );
  expect(summary).toEqual([]);
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`accessibility in ${colorScheme} mode`, () => {
    test.use({ colorScheme });

    test("home page", async ({ page }) => {
      await page.goto("./");
      await expectNoViolations(page);
    });

    test("loaded wall and pool", async ({ page }) => {
      await loadWall(page);
      await expectNoViolations(page);
    });

    test("album action sheet", async ({ page }) => {
      await loadWall(page);
      await page.locator("[data-album-id]").first().click();
      const sheet = page.getByRole("dialog");
      await expect(sheet).toBeVisible();
      // The details from Discogs are part of what is checked.
      await expect(sheet.getByText(/^1999 · Label \d+$/)).toBeVisible();
      await expect(sheet.getByText("Rock · Hard Rock, Blues Rock")).toBeVisible();
      await expectNoViolations(page);
    });

    test("pool search", async ({ page }) => {
      await loadWall(page);
      await page.getByRole("searchbox", { name: "Search" }).fill("Album 40");
      await expect(page.getByText("1 of 8 albums")).toBeVisible();
      await expectNoViolations(page);
    });

    test("gradient builder", async ({ page }) => {
      await loadWall(page);
      await page.getByRole("button", { name: "Color" }).click();
      await expect(page.getByRole("button", { name: "Build wall" })).toBeVisible();
      // Let the pressed button finish changing color before checking contrast.
      await page.evaluate(() =>
        Promise.all(document.getAnimations().map((animation) => animation.finished))
      );
      await expectNoViolations(page);
    });

    test("saved walls panel with wall history", async ({ page }) => {
      await loadWall(page);
      await page.getByRole("button", { name: "Saved walls" }).click();
      await page.getByLabel("Name for the current wall").fill("Autumn");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await page.getByRole("button", { name: "More for Autumn" }).click();
      await page.getByRole("menuitem", { name: "Mark as on my wall" }).click();
      await page.getByRole("button", { name: "More for Autumn" }).click();
      await expect(page.getByRole("menuitem", { name: "On my wall" })).toBeVisible();
      await expectNoViolations(page);
    });

    test("export menu", async ({ page }) => {
      await loadWall(page);
      await page.getByRole("button", { name: /Save image/ }).click();
      await expectNoViolations(page);
    });

    test("wall size panel", async ({ page }) => {
      await loadWall(page);
      await page.getByRole("button", { name: "Wall size" }).click();
      await expect(page.getByRole("heading", { name: "Wall size" })).toBeVisible();
      await expectNoViolations(page);
    });

    for (const [name, status, body] of [
      ["no such user", 404, { error: 'User "someone" not found on Discogs' }],
      ["Discogs not answering", 502, { error: "Discogs server error. Please try again later." }],
      ["private collection", 403, { code: "private", error: "Private." }],
    ] as const) {
      test(`load error: ${name}`, async ({ page }) => {
        await stubNetwork(page);
        await page.route(
          (url) => url.searchParams.has("username"),
          (route) =>
            route.fulfill({
              status,
              contentType: "application/json",
              headers: { "Access-Control-Allow-Origin": "*" },
              body: JSON.stringify(body),
            })
        );
        await page.goto("./");
        await page.getByLabel("Discogs username").fill("someone");
        await page.getByRole("button", { name: "Load Collection" }).click();
        // The framework adds its own, empty, route announcer with the same role.
        await expect(page.locator("main").getByRole("alert")).toBeVisible();
        await expectNoViolations(page);
      });
    }
  });

  test.describe(`accessibility on a phone in ${colorScheme} mode`, () => {
    test.use({ colorScheme, viewport: { width: 360, height: 780 }, hasTouch: true });

    test("loaded wall", async ({ page }) => {
      await loadWall(page);
      await expectNoViolations(page);
    });

    test("gradient builder sheet", async ({ page }) => {
      await loadWall(page);
      await page.getByRole("button", { name: "Color" }).click();
      await expect(page.getByRole("button", { name: "Build wall" })).toBeVisible();
      await page.evaluate(() =>
        Promise.all(document.getAnimations().map((animation) => animation.finished))
      );
      await expectNoViolations(page);
    });

    test("album action sheet", async ({ page }) => {
      await loadWall(page);
      await page.locator("[data-album-id]").first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expectNoViolations(page);
    });
  });
}
