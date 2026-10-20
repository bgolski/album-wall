import { expect, test } from "@playwright/test";
import { loadWall } from "./support";

test("saving the wall as an image downloads a PNG", async ({ page }) => {
  await loadWall(page);
  await page.getByRole("button", { name: /Save image/ }).click();

  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Wall as shown" }).click();

  expect((await download).suggestedFilename()).toBe("someone_album_wall.png");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true });

  test("saves the wall at full size, not at the size the phone shows it", async ({ page }) => {
    await loadWall(page);
    await page.getByRole("button", { name: /Save image/ }).click();

    const download = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: "Wall as shown" }).click();

    const png = await (await download).createReadStream().then(async (stream) => {
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(chunk as Buffer);
      return Buffer.concat(chunks);
    });
    // The PNG header holds width and height at bytes 16 and 20. The phone shows the wall under 400
    // pixels wide; saved at that size (twice the density) it would be well under a million pixels.
    expect(png.readUInt32BE(16) * png.readUInt32BE(20)).toBeGreaterThan(2_500_000);
  });
});
