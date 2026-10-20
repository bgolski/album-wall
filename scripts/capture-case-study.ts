import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, type Browser, type Page } from "@playwright/test";

// Captures the README and portfolio screenshots from the static export served by
// scripts/serve-static.ts (build with npm run build:static, then start the server first).
// Usage: node scripts/capture-case-study.ts [outputDir]
//        node scripts/capture-case-study.ts --og   (only the link preview image, public/og-image.jpg)
const port = Number(process.env.PORT ?? 3100);
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";
const url = `http://localhost:${port}${basePath}/`;
const args = process.argv.slice(2);
const ogOnly = args.includes("--og");
const out = args.find((arg) => !arg.startsWith("--")) ?? "docs/screenshots";

// Covers load as their tiles near the screen, so scroll through the page to bring them all in.
async function coversLoaded(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= height; y += 500) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(100);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(
    () => {
      const tiles = document.querySelectorAll("[data-album-id]").length;
      const images = [...document.querySelectorAll("img")];
      return (
        tiles > 0 &&
        images.length >= tiles &&
        images.every((img) => img.complete && img.naturalWidth > 0)
      );
    },
    undefined,
    { timeout: 60_000 }
  );
}

// The 1200 by 630 picture shown when a link to the app is shared: the demo wall, light theme.
async function captureShareImage(browser: Browser) {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    colorScheme: "light",
  });
  await page.goto(url);
  await page.getByRole("button", { name: "Try the demo", exact: true }).click();
  await page.locator("[data-album-id]").first().waitFor();
  await coversLoaded(page);
  await page.screenshot({ path: "public/og-image.jpg", type: "jpeg", quality: 82 });
  await page.close();
}

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
if (ogOnly) {
  await captureShareImage(browser);
  await browser.close();
  console.log("Captured public/og-image.jpg");
  process.exit(0);
}
// Reduced motion keeps the record and the welcome card still, so every shot is the same.
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
await page.goto(url);

// 1. Fresh visit: sign in or enter a username, with the demo offered below.
await page.getByRole("button", { name: "Try the demo", exact: true }).waitFor();
await page.screenshot({ path: `${out}/01-fresh-visit.png` });

// 2. The demo's 8 x 4 wall beside the record pool.
await page.getByRole("button", { name: "Try the demo", exact: true }).click();
await page.locator("[data-album-id]").first().waitFor();
await coversLoaded(page);
await page.screenshot({ path: `${out}/02-wall-and-pool.png`, fullPage: true });

// 3. Pin four records, then shuffle: pinned records stay where they are.
for (const title of ["Thriller", "Rumours", "Nevermind", "Led Zeppelin IV"]) {
  await page
    .getByRole("button", { name: `Pin ${title}`, exact: true })
    .first()
    .click();
}
await page.getByRole("button", { name: "Shuffle", exact: true }).click();
await coversLoaded(page);
await page.screenshot({ path: `${out}/03-pin-and-shuffle.png` });

// 4. Save or share: the image menu with its sized options.
await page.getByRole("button", { name: /Save image/ }).click();
await page.getByRole("menuitem", { name: "Wall as shown" }).waitFor();
await page.screenshot({ path: `${out}/04-save-image-menu.png` });
await page.keyboard.press("Escape");

// 5. Arrange by genre: one tap on a choice builds the wall.
await page.getByRole("button", { name: "Genre", exact: true }).click();
// Let the button colors finish their transition.
await page.waitForTimeout(500);
const toolbar = page.locator("div.rounded-panel", {
  has: page.getByRole("group", { name: "Arrange by genre" }),
});
await toolbar.screenshot({ path: `${out}/05-arrange-by-genre.png` });

// 6. Sort by Color: gradients suggested for this collection, and the gradient editor.
await page.getByRole("button", { name: "Color", exact: true }).click();
await page.getByText("Suggested", { exact: true }).waitFor();
await page.waitForTimeout(500);
const builder = page.locator("section", {
  has: page.getByRole("heading", { name: "Color", exact: true }),
});
await builder.screenshot({ path: `${out}/06-sort-by-color.png` });

// 7. A rainbow wall built from the whole collection (unpinned first, so every spot is free).
await page.getByRole("button", { name: "Pin all", exact: true }).click();
await page.getByRole("button", { name: "Pin all", exact: true }).click();
await page.getByRole("button", { name: /Rainbow/ }).click();
await page.getByRole("button", { name: "Build wall" }).click();
await page.getByText(/^Wall built/).waitFor();
await coversLoaded(page);
const wall = page
  .locator("div.rounded-panel", { has: page.getByRole("heading", { name: /Your wall/ }) })
  .first();
await wall.screenshot({ path: `${out}/07-gradient-wall.png` });
await page.close();

// 8. On a phone.
const phone = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true,
  reducedMotion: "reduce",
});
await phone.addInitScript(() => localStorage.setItem("album-wall:welcome-dismissed", "1"));
await phone.goto(url);
await phone.getByRole("button", { name: "Try the demo wall" }).click();
await phone.locator("[data-album-id]").first().waitFor();
await coversLoaded(phone);
await phone.screenshot({ path: `${out}/08-phone.png` });

await browser.close();

const revision = execFileSync("git", ["rev-parse", "--short", "HEAD"]).toString().trim();
writeFileSync(
  `${out}/capture.json`,
  JSON.stringify(
    {
      revision,
      route: `${basePath}/`,
      viewport: "1440x1000 (scene 8: 390x844 phone)",
      capturedAt: new Date().toISOString(),
    },
    null,
    2
  ) + "\n"
);
console.log(`Captured eight scenes at ${revision} from ${url}`);
