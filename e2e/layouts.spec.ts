import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { stubNetwork } from "./support";

const wallIds = (page: Page) =>
  page
    .locator("[data-album-id]")
    .evaluateAll((nodes) => nodes.slice(0, 32).map((node) => node.getAttribute("data-album-id")));

test("save a layout, change the wall, compare, put the layout back, and keep it after a reload", async ({
  page,
}) => {
  await stubNetwork(page);
  await page.goto("./");
  await page.getByRole("button", { name: "Try the demo wall" }).click();
  await expect(page.locator("[data-album-id]").first()).toBeVisible();

  await page.getByRole("button", { name: "Layouts" }).click();
  await page.getByLabel("Name for the current wall").fill("First");
  await page.getByRole("button", { name: "Save current wall" }).click();
  const saved = await wallIds(page);

  await page.getByRole("button", { name: "Shuffle", exact: true }).click();
  await expect.poll(() => wallIds(page)).not.toEqual(saved);

  await page.getByRole("button", { name: "Compare First with the wall" }).click();
  const diagram = page.getByRole("group", { name: 'Diagram of "First"' });
  await expect(diagram).toBeVisible();
  await expect(diagram.getByRole("button")).toHaveCount(32);
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByText(/^Step 1 of \d+$/)).toBeVisible();
  // A step outlines where its cover comes from, where it goes, or both.
  await expect(
    diagram.locator('[data-state="destination"], [data-state="source"]')
  ).not.toHaveCount(0);
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText(/^Step 2 of \d+$/)).toBeVisible();

  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  }

  await page.getByRole("button", { name: "Put First on the wall" }).click();
  await expect.poll(() => wallIds(page)).toEqual(saved);

  await page.reload();
  await page.getByRole("button", { name: "Try the demo wall" }).click();
  await page.getByRole("button", { name: "Layouts" }).click();
  await expect(page.getByRole("list", { name: "Saved layouts" }).getByText("First")).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save backup file" }).click();
  const file = await (await download).path();
  await page.getByLabel("Load backup file").setInputFiles(file);
  await expect(page.getByText("Added 0 layouts, skipped 1 already here or damaged.")).toBeVisible();
});
