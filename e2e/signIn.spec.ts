import { expect, test, type Route } from "@playwright/test";
import { albums, stubNetwork } from "./support";
import {
  buildShareHash,
  buildSharedWallState,
  encodeSharedWallState,
} from "../src/utils/shareState";

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(body),
  });

test("signs in with Discogs, loads a folder, and signs out", async ({ page }) => {
  await stubNetwork(page);
  const collectionRequests: { folder: string | null; authorization: string | undefined }[] = [];
  const finishBodies: unknown[] = [];
  let callback = "";

  await page.route(
    (url) => url.searchParams.has("username") && !url.pathname.endsWith("/folders"),
    (route) => {
      const url = new URL(route.request().url());
      const folder = url.searchParams.get("folder");
      collectionRequests.push({ folder, authorization: route.request().headers().authorization });
      return json(route, { username: "Collector", albums: folder ? albums.slice(0, 5) : albums });
    }
  );
  await page.route(
    (url) => url.pathname.endsWith("/folders"),
    (route) =>
      json(route, {
        folders: [
          { id: 0, name: "All", count: 40 },
          { id: 9, name: "Wall", count: 5 },
        ],
      })
  );
  await page.route(
    (url) => url.pathname.endsWith("/oauth/start"),
    (route) => {
      callback = route.request().postDataJSON().callback;
      return json(route, {
        authorizeUrl: "https://www.discogs.com/oauth/authorize?oauth_token=reqtoken",
        token: "reqtoken",
        secret: "reqsecret",
      });
    }
  );
  // Discogs' approval page: approving sends the visitor back with a verifier.
  await page.route("https://www.discogs.com/oauth/authorize?**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: `<script>location.replace(${JSON.stringify(
        `${callback}?oauth_token=reqtoken&oauth_verifier=verifier1`
      )})</script>`,
    })
  );
  await page.route(
    (url) => url.pathname.endsWith("/oauth/finish"),
    (route) => {
      finishBodies.push(route.request().postDataJSON());
      return json(route, { username: "Collector", token: "accesstoken", secret: "accesssecret" });
    }
  );

  await page.goto("./");
  // The privacy page is linked from the footer.
  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Privacy" })
  ).toHaveAttribute("href", /\/privacy\/$/);
  await page.getByRole("button", { name: "Sign in with Discogs" }).click();

  // Back from Discogs: signed in, and the visitor's own collection loads with their sign-in.
  const account = page.getByRole("button", { name: "Account: signed in as Collector" });
  await expect(account).toBeVisible();
  await expect(page.locator("[data-album-id]").first()).toBeVisible();
  expect(new URL(callback).pathname).toMatch(/\/$/);
  expect(finishBodies).toEqual([{ token: "reqtoken", secret: "reqsecret", verifier: "verifier1" }]);
  expect(page.url()).not.toContain("oauth_verifier");
  expect(collectionRequests.at(-1)).toEqual({
    folder: null,
    authorization: "Bearer accesstoken:accesssecret",
  });
  await expect(page.getByRole("link", { name: "Collector" })).toBeVisible();

  // A folder.
  await page.getByLabel("Folder").selectOption({ label: "Wall (5)" });
  await expect.poll(() => collectionRequests.at(-1)?.folder).toBe("9");
  await expect(page.locator("[data-album-id]")).toHaveCount(5);

  // Signing out forgets the token in this browser.
  await account.click();
  await expect(page.locator("#account-menu")).toContainText("Collector");
  await page.getByRole("button", { name: "Sign out" }).click();
  // The wall stays; the corner offers signing in again.
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByLabel("Folder")).toHaveCount(0);
  const stored = await page.evaluate(() => ({
    session: localStorage.getItem("album-wall:discogs-sign-in"),
    pending: sessionStorage.getItem("album-wall:discogs-sign-in-pending"),
    everything: JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }),
  }));
  expect(stored.session).toBeNull();
  expect(stored.pending).toBeNull();
  expect(stored.everything).not.toContain("accesssecret");
  expect(stored.everything).not.toContain("reqsecret");
});

test("explains a shared wall from a private collection", async ({ page }) => {
  await stubNetwork(page);
  await page.route(
    (url) => url.searchParams.has("username"),
    (route) =>
      json(
        route,
        { code: "private", error: 'The collection of "owner" is private on Discogs.' },
        403
      )
  );
  const hash = buildShareHash(
    encodeSharedWallState(
      buildSharedWallState({
        username: "owner",
        rows: 1,
        columns: 2,
        wallAlbumIds: ["1", "2"],
        pinnedAlbumIds: [],
      })
    )
  );

  await page.goto(`./${hash}`);
  await expect(page.getByRole("heading", { name: "Private collection" })).toBeVisible();
  await expect(page.getByText(/shared from a private Discogs collection/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign in with Discogs" })).toHaveCount(2);
});
