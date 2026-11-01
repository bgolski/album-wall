import { expect, test, type Page } from "@playwright/test";
import { loadWall } from "./support";

// Where the dragged cover is drawn, and where the pointer sits on it.
const preview = (page: Page) => page.locator(".cursor-grabbing");

async function expectUnderPointer(
  page: Page,
  pointer: { x: number; y: number },
  grab: { x: number; y: number }
) {
  await expect
    .poll(async () => {
      const box = await preview(page).boundingBox();
      // How far the pointer is from the spot it grabbed, allowing for sub-pixel rounding.
      return box
        ? Math.max(Math.abs(pointer.x - box.x - grab.x), Math.abs(pointer.y - box.y - grab.y))
        : Infinity;
    })
    .toBeLessThanOrEqual(2);
}

async function grabTile(page: Page, index: number, scrollBy: number) {
  // Wait for the page to finish sliding in, so the cover is not still moving when it is grabbed.
  await page
    .locator(".app-intro")
    .evaluate((node) => Promise.all(node.getAnimations().map((animation) => animation.finished)));
  await page.evaluate((y) => window.scrollTo(0, y), scrollBy);
  const tile = page.locator("#grid-container [data-album-id]").nth(index);
  await tile.scrollIntoViewIfNeeded();
  const box = (await tile.boundingBox())!;
  // Grabbed off-center, so a preview that is merely near the pointer does not pass.
  const grab = { x: box.width * 0.3, y: box.height * 0.7 };
  return { start: { x: box.x + grab.x, y: box.y + grab.y }, grab };
}

// The intro (played on the first load of a visit) must not move the dragged cover off the
// pointer, so these run with motion on.
for (const scrolled of [0, 400]) {
  const where = scrolled ? "with the page scrolled" : "at the top of the page";

  test.describe(`the dragged cover stays under the pointer ${where}`, () => {
    test.describe("with a mouse", () => {
      test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: "no-preference" });

      test("on a desktop", async ({ page }) => {
        await loadWall(page);
        const { start, grab } = await grabTile(page, 9, scrolled);
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        const end = { x: start.x + 120, y: start.y - 60 };
        await page.mouse.move(end.x, end.y, { steps: 10 });
        await expectUnderPointer(page, end, grab);
        await page.mouse.up();
      });
    });

    test.describe("by touch", () => {
      test.use({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
        reducedMotion: "no-preference",
      });

      test("on a phone", async ({ page }) => {
        await loadWall(page);
        const { start, grab } = await grabTile(page, 4, scrolled);
        const cdp = await page.context().newCDPSession(page);
        const touch = (
          type: "touchStart" | "touchMove" | "touchEnd",
          point?: { x: number; y: number }
        ) =>
          cdp.send("Input.dispatchTouchEvent", {
            type,
            touchPoints: point ? [{ x: point.x, y: point.y }] : [],
          });
        await touch("touchStart", start);
        // Covers are picked up by pressing and holding.
        await page.waitForTimeout(400);
        const end = { x: start.x + 60, y: start.y + 80 };
        for (let step = 1; step <= 10; step++) {
          await touch("touchMove", {
            x: start.x + ((end.x - start.x) * step) / 10,
            y: start.y + ((end.y - start.y) * step) / 10,
          });
        }
        await expectUnderPointer(page, end, grab);
        await touch("touchEnd");
      });
    });
  });
}
