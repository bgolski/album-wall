import { expect, test, type Page } from "@playwright/test";
import { stubNetwork } from "./support";

const wallIds = (page: Page) =>
  page
    .locator("[data-album-id]")
    .evaluateAll((nodes) => nodes.slice(0, 32).map((node) => node.getAttribute("data-album-id")!));

async function openCollection(page: Page, name: string) {
  await page.getByRole("button", { name: "Open another collection" }).click();
  await page.getByLabel("Discogs username").fill(name);
  await page.getByRole("button", { name: "Load Collection" }).click();
  await expect(page.getByRole("link", { name })).toBeVisible();
}

test("a ?user= link opens that collection and the address follows what is on the wall", async ({
  page,
}) => {
  await stubNetwork(page);
  const asked: string[] = [];
  page.on("request", (request) => {
    const name = new URL(request.url()).searchParams.get("username");
    if (name) asked.push(name);
  });

  await page.goto("./?user=firstfan");
  await expect(page.getByRole("link", { name: "firstfan" })).toBeVisible();
  expect(asked).toEqual(["firstfan"]);

  await openCollection(page, "secondfan");
  expect(new URL(page.url()).searchParams.get("user")).toBe("secondfan");
  expect(asked).toEqual(["firstfan", "secondfan"]);

  // The demo has no collection of its own to name.
  await page.getByRole("button", { name: "Open another collection" }).click();
  await page.getByRole("button", { name: "Demo", exact: true }).click();
  await expect(page.getByText("Demo wall")).toBeVisible();
  expect(new URL(page.url()).searchParams.has("user")).toBe(false);
});

test("each collection keeps its own wall when going between them", async ({ page }) => {
  await stubNetwork(page);
  await page.goto("./?user=firstfan");
  await expect(page.getByRole("link", { name: "firstfan" })).toBeVisible();
  await expect(page.locator("[data-album-id]").first()).toBeVisible();
  const original = await wallIds(page);

  await page.getByRole("button", { name: "Shuffle" }).click();
  const shuffled = await wallIds(page);
  expect(shuffled).not.toEqual(original);

  await openCollection(page, "secondfan");
  await expect(page.locator("[data-album-id]").first()).toBeVisible();
  expect(await wallIds(page)).toEqual(original);

  await openCollection(page, "firstfan");
  await expect(page.locator("[data-album-id]").first()).toBeVisible();
  expect(await wallIds(page)).toEqual(shuffled);
});
