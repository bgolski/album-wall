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
  // It follows a whole rehang, one Done per step (about forty), so it needs more time than most.
  test.slow();
  await stubNetwork(page);
  await page.goto("./");
  await page.getByRole("button", { name: "Try the demo wall" }).click();
  await expect(page.locator("[data-album-id]").first()).toBeVisible();

  await page.getByRole("button", { name: "Saved walls" }).click();
  await page.getByLabel("Name for the current wall").fill("First");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const saved = await wallIds(page);

  await page.getByRole("button", { name: "Shuffle", exact: true }).click();
  await expect.poll(() => wallIds(page)).not.toEqual(saved);

  await page.getByRole("button", { name: "More for First" }).click();
  await page.getByRole("menuitem", { name: "Rehang" }).click();
  const guide = page.getByRole("group", { name: "Hang First" });
  await expect(guide).toBeVisible();
  await expect(guide.getByText(/^1 \/ \d+$/)).toBeVisible();
  await guide.getByRole("button", { name: "Done" }).click();
  await expect(guide.getByText(/^2 \/ \d+$/)).toBeVisible();
  await guide.getByRole("button", { name: "Back" }).click();
  await expect(guide.getByText(/^1 \/ \d+$/)).toBeVisible();

  // Cancelling (here with Escape) leaves only the guide: the panel and its list stay.
  await page.keyboard.press("Escape");
  await expect(guide).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Saved walls" })).toBeVisible();
  await page.getByRole("button", { name: "More for First" }).click();
  await page.getByRole("menuitem", { name: "Rehang" }).click();
  await expect(guide).toBeVisible();

  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  }

  // The last Done finishes: the saved wall is on screen and the list is back.
  for (let step = 0; step < 100 && (await guide.isVisible()); step += 1) {
    await guide.getByRole("button", { name: "Done" }).click();
  }
  await expect(guide).toHaveCount(0);
  await expect.poll(() => wallIds(page)).toEqual(saved);

  await page.reload();
  await page.getByRole("button", { name: "Try the demo wall" }).click();
  await page.getByRole("button", { name: "Saved walls" }).click();
  await expect(page.getByRole("list", { name: "Saved walls" }).getByText("First")).toBeVisible();

  await page.getByRole("button", { name: "Backup", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Save backup file" }).click();
  const file = await (await download).path();
  await page.getByLabel("Load backup file").setInputFiles(file);
  // Finishing the guide counted the wall as hung, so the backup carries that history too.
  await expect(
    page.getByText(/^Added 0 saved walls, skipped 1 already here or damaged/)
  ).toBeVisible();
});

// The albums on the wall itself (the pool follows it on a phone).
const onWall = (page: Page) =>
  page
    .locator("#grid-container [data-album-id]")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-album-id")));

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });

  test("rehanging a saved wall is followed one step at a time, with Done always in reach", async ({
    page,
  }) => {
    await stubNetwork(page);
    await page.goto("./");
    await page.getByRole("button", { name: "Try the demo wall" }).click();
    await expect(page.locator("[data-album-id]").first()).toBeVisible();
    await page.getByRole("button", { name: "Saved walls" }).click();
    await page.getByLabel("Name for the current wall").fill("First");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const saved = await onWall(page);
    await page.getByRole("button", { name: "Shuffle", exact: true }).click();
    await expect.poll(() => onWall(page)).not.toEqual(saved);

    await page.getByRole("button", { name: "More for First" }).tap();
    await page.getByRole("menuitem", { name: "Rehang" }).tap();
    const guide = page.getByRole("group", { name: "Hang First" });
    const done = guide.getByRole("button", { name: "Done" });
    await expect(guide).toBeVisible();

    // Every step fits the bottom sheet: Done never needs a scroll to reach.
    for (let step = 0; step < 100 && (await guide.isVisible()); step += 1) {
      await expect(done).toBeInViewport({ ratio: 1 });
      await done.tap();
    }
    await expect(guide).toHaveCount(0);
    // Finishing puts the saved wall on screen.
    expect(await onWall(page)).toEqual(saved);
  });
});
