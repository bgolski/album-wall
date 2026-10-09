import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { loadWall } from "./support";

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
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
      await expect(page.getByRole("dialog")).toBeVisible();
      await expectNoViolations(page);
    });

    test("pool search", async ({ page }) => {
      await loadWall(page);
      await page.getByRole("searchbox", { name: "Search" }).fill("Album 40");
      await expect(page.getByText("1 of 8 albums")).toBeVisible();
      await expectNoViolations(page);
    });

    test("export menu", async ({ page }) => {
      await loadWall(page);
      await page.getByRole("button", { name: /Export/ }).click();
      await expectNoViolations(page);
    });
  });
}
