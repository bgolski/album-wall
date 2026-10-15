import { expect, test, type Page } from "@playwright/test";
import { stubNetwork } from "./support";
import { buildShareHash, decodeSharedWallState } from "../src/utils/shareState";

const ids = (page: Page) =>
  page
    .locator("[data-album-id]")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-album-id")));

function watchDiscogs(page: Page) {
  const requests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (/discogs/i.test(url.hostname + url.search)) requests.push(request.url());
  });
  return requests;
}

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test("a first-time visitor is offered the demo, and only once", async ({ page }) => {
  await page.route(/images\.weserv\.nl/, (route) => route.fulfill({ status: 404 }));
  const discogsRequests = watchDiscogs(page);

  await page.goto("./");
  const dialog = page.getByRole("dialog", { name: "New to Album Wall?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Try the demo" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Demo wall", { exact: true })).toBeVisible();
  expect(discogsRequests).toEqual([]);

  await page.reload();
  await expect(page.getByRole("button", { name: "Load Collection" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("a visitor who closes the welcome is not asked again", async ({ page }) => {
  await page.route(/images\.weserv\.nl/, (route) => route.fulfill({ status: 404 }));
  await page.goto("./");
  await page.getByRole("button", { name: "Use my collection" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Load Collection" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("a returning visitor can still try the demo from the header", async ({ page }) => {
  await stubNetwork(page);
  const discogsRequests = watchDiscogs(page);

  await page.goto("./");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Try the demo wall" }).click();
  await expect(page.getByText("Demo wall", { exact: true })).toBeVisible();
  await expect(page.locator("[data-album-id]").first()).toBeVisible();
  expect(discogsRequests).toEqual([]);

  await page.getByRole("button", { name: "Shuffle" }).click();
  await page.getByRole("button", { name: "Share link" }).click();
  await expect(page.getByText("Share link copied.")).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toContain("#share=");

  // A share link records the wall (and pins), not the order of the pool below it.
  const shared = decodeSharedWallState(link.split("#share=")[1] ?? "")!;
  expect(shared.username).toBe("~demo");
  const wallSize = shared.wallAlbumIds.length;
  expect((await ids(page)).slice(0, wallSize)).toEqual(shared.wallAlbumIds);

  await page.goto(link);
  await page.reload();
  await expect(page.getByText("Demo wall", { exact: true })).toBeVisible();
  await expect(page.locator("[data-album-id]").first()).toBeVisible();
  expect((await ids(page)).slice(0, wallSize)).toEqual(shared.wallAlbumIds);

  // Links made before the compact format still open the same wall.
  const oldLink =
    link.split("#")[0] + buildShareHash(Buffer.from(JSON.stringify(shared)).toString("base64url"));
  await page.goto(oldLink);
  await page.reload();
  await expect(page.locator("[data-album-id]").first()).toBeVisible();
  expect((await ids(page)).slice(0, wallSize)).toEqual(shared.wallAlbumIds);
  expect(discogsRequests).toEqual([]);
});
