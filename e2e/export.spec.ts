import { expect, test } from "@playwright/test";
import { loadWall } from "./support";

const bytesOf = async (download: import("@playwright/test").Download) => {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
};

test("saving the wall as an image downloads a PNG", async ({ page }) => {
  await loadWall(page);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("button", { name: "Wall", exact: true }).click();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();

  expect((await download).suggestedFilename()).toBe("someone_album_wall.png");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
});

test("a phone wallpaper is saved at its size, on the chosen background", async ({ page }) => {
  await loadWall(page);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("button", { name: "Phone", exact: true }).click();
  await page.getByRole("button", { name: "Light", exact: true }).click();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const saved = await download;

  expect(saved.suggestedFilename()).toBe("someone_album_wall_phone.png");
  const png = await bytesOf(saved);
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1179, 2556]);
});

test("a desktop wallpaper can have the record behind the wall", async ({ page }) => {
  await loadWall(page);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("button", { name: "Desktop", exact: true }).click();
  await page.getByRole("button", { name: "Record", exact: true }).click();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const saved = await download;

  expect(saved.suggestedFilename()).toBe("someone_album_wall_desktop.png");
  const png = await bytesOf(saved);
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([2560, 1440]);
});

test("a poster is made by the service, the same on any device, and saved", async ({ page }) => {
  await loadWall(page);
  let sent: Record<string, unknown> | null = null;
  await page.route(/\/poster$/, async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "image/jpeg",
      headers: { "access-control-allow-origin": "*", "x-covers-left-out": "0" },
      body: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    });
  });
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("button", { name: "Poster", exact: true }).click();
  await page.getByRole("button", { name: "24 × 36", exact: true }).click();
  await page.getByRole("button", { name: "Record", exact: true }).click();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const saved = await download;

  expect(saved.suggestedFilename()).toBe("someone_album_wall_poster_24x36.jpg");
  expect(sent).toMatchObject({ size: "24x36", background: "record", rows: 4, columns: 8 });
  expect((sent as unknown as { covers: string[] }).covers).toHaveLength(32);
});

test("a poster that cannot be made says why", async ({ page }) => {
  await loadWall(page);
  await page.route(/\/poster$/, (route) =>
    route.fulfill({
      status: 429,
      headers: { "access-control-allow-origin": "*" },
      body: "used up",
    })
  );
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("button", { name: "Poster", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Posters are used up for today")).toBeVisible();
});

test("the guide adds the steps from the wall that was hung last", async ({ page }) => {
  await loadWall(page);
  // Mark this wall as the one on the real wall, then change it.
  await page.getByRole("button", { name: "Saved walls" }).click();
  await page.getByLabel("Name for the current wall").fill("Autumn");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "More for Autumn" }).click();
  await page.getByRole("menuitem", { name: "Mark as on my wall" }).click();
  await page.getByRole("button", { name: "Shuffle" }).click();

  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("button", { name: "Guide", exact: true }).click();
  const steps = page.getByRole("button", { name: "Steps", exact: true });
  await expect(steps).toHaveAttribute("aria-pressed", "true");

  const pagesOf = async (text: string) => Number(text.match(/\/Count (\d+)/)![1]);
  let download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const withSteps = await pagesOf((await bytesOf(await download)).toString("latin1"));

  await steps.click();
  download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const without = await pagesOf((await bytesOf(await download)).toString("latin1"));

  expect(withSteps).toBeGreaterThan(without);
});

test("the hanging guide is saved as a PDF", async ({ page }) => {
  await loadWall(page);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("button", { name: "Guide", exact: true }).click();
  await expect(page.getByRole("group", { name: "Background" })).toHaveCount(0);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const saved = await download;

  expect(saved.suggestedFilename()).toBe("someone_album_wall_guide.pdf");
  const pdf = await bytesOf(saved);
  expect(pdf.subarray(0, 8).toString("latin1")).toBe("%PDF-1.4");
  expect(pdf.subarray(-6).toString("latin1")).toContain("%%EOF");
  expect(pdf.toString("latin1")).toMatch(/\/Count [1-9]/);
});

test.describe("poster on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("asks the service for the same poster a computer would", async ({ page }) => {
    await loadWall(page);
    let sent: Record<string, unknown> | null = null;
    await page.route(/\/poster$/, async (route) => {
      sent = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "image/jpeg",
        headers: { "access-control-allow-origin": "*" },
        body: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
      });
    });
    await page.getByRole("button", { name: "Export", exact: true }).tap();
    await page.getByRole("button", { name: "Poster", exact: true }).tap();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Save", exact: true }).tap();
    expect((await download).suggestedFilename()).toBe("someone_album_wall_poster_18x24.jpg");
    expect(sent).toMatchObject({
      size: "18x24",
      rows: expect.any(Number),
      columns: expect.any(Number),
    });
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true });

  test("saves the wall at full size, not at the size the phone shows it", async ({ page }) => {
    await loadWall(page);
    await page.getByRole("button", { name: "Export", exact: true }).click();
    await page.getByRole("button", { name: "Wall", exact: true }).click();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Save", exact: true }).click();

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
