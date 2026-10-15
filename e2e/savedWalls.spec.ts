import { expect, test, type Route } from "@playwright/test";
import { stubNetwork, albums } from "./support";

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(body),
  });

test("a signed-in visitor finds layouts saved on another device, and new ones are saved to the account", async ({
  page,
}) => {
  await stubNetwork(page);
  await page.addInitScript(() =>
    localStorage.setItem(
      "album-wall:discogs-sign-in",
      JSON.stringify({ v: 1, username: "someone", token: "tok", secret: "sec" })
    )
  );
  const wall = {
    v: 1,
    username: "someone",
    rows: 4,
    columns: 8,
    wallAlbumIds: albums.slice(0, 32).map((album) => String(album.id)),
    pinnedAlbumIds: [],
  };
  const fromPhone = {
    v: 1,
    id: "phone-1",
    name: "From my phone",
    savedAt: "2026-10-14T20:00:00.000Z",
    wall,
  };
  const saves: { kind: string; data: string; authorization: string | undefined }[] = [];
  await page.route(
    (url) => url.pathname.endsWith("/saved"),
    (route) => {
      if (route.request().method() === "GET") {
        return json(route, {
          layouts: { data: JSON.stringify({ v: 1, layouts: [fromPhone] }), updatedAt: "t1" },
          history: null,
        });
      }
      saves.push({
        ...route.request().postDataJSON(),
        authorization: route.request().headers().authorization,
      });
      return json(route, { updatedAt: `t${saves.length + 1}` });
    }
  );

  await page.goto("./");
  await page.getByLabel("Discogs username").fill("someone");
  await page.getByRole("button", { name: "Load Collection" }).click();
  await expect(page.locator("[data-album-id]").first()).toBeVisible();

  await page.getByRole("button", { name: "Layouts" }).click();
  await expect(page.getByText("From my phone")).toBeVisible();

  await page.getByLabel("Name for the current wall").fill("Living room");
  await page.getByRole("button", { name: "Save current wall" }).click();
  await expect.poll(() => saves.filter((save) => save.data.includes("Living room")).length).toBe(1);
  const save = saves.find((entry) => entry.data.includes("Living room"))!;
  expect(save.kind).toBe("layouts");
  expect(save.data).toContain("From my phone");
  expect(save.authorization).toBe("Bearer tok:sec");
});

test("signed out, nothing is sent to an account", async ({ page }) => {
  await stubNetwork(page);
  let accountRequests = 0;
  await page.route(
    (url) => url.pathname.includes("/saved"),
    (route) => {
      accountRequests += 1;
      return json(route, {});
    }
  );
  await page.goto("./");
  await page.getByLabel("Discogs username").fill("someone");
  await page.getByRole("button", { name: "Load Collection" }).click();
  await expect(page.locator("[data-album-id]").first()).toBeVisible();
  await page.getByRole("button", { name: "Layouts" }).click();
  await page.getByLabel("Name for the current wall").fill("Local only");
  await page.getByRole("button", { name: "Save current wall" }).click();
  await expect(page.getByText("Local only", { exact: true }).first()).toBeVisible();
  expect(accountRequests).toBe(0);
});
