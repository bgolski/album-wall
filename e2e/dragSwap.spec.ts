import { expect, test } from "@playwright/test";
import { loadWall } from "./support";

const ids = (page: import("@playwright/test").Page) =>
  page
    .locator("#grid-container [data-album-id]")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-album-id")));

// Grab a cover at one point of it, and drop with the pointer at one point of another.
async function drag(
  page: import("@playwright/test").Page,
  from: number,
  to: number,
  grab: [number, number],
  drop: [number, number]
) {
  const tiles = page.locator("#grid-container [data-album-id]");
  const start = (await tiles.nth(from).boundingBox())!;
  const end = (await tiles.nth(to).boundingBox())!;
  await page.mouse.move(start.x + start.width * grab[0], start.y + start.height * grab[1]);
  await page.mouse.down();
  await page.mouse.move(
    start.x + start.width * grab[0] + 10,
    start.y + start.height * grab[1] - 10,
    {
      steps: 3,
    }
  );
  await page.mouse.move(end.x + end.width * drop[0], end.y + end.height * drop[1], { steps: 15 });
  await page.mouse.up();
}

test.describe("dropping a dragged cover", () => {
  // Tall enough that the whole wall is on screen, so the pointer can reach every cover.
  test.use({ viewport: { width: 1280, height: 1500 } });

  for (const [name, from, to, grab, drop] of [
    ["up, grabbed low, dropped high on the cover", 24, 16, [0.5, 0.9], [0.5, 0.2]],
    ["up two rows, grabbed low", 24, 8, [0.5, 0.9], [0.5, 0.15]],
    ["down, grabbed high, dropped low on the cover", 8, 16, [0.5, 0.1], [0.5, 0.85]],
    ["up, grabbed high (the easy case)", 24, 16, [0.5, 0.2], [0.5, 0.5]],
    ["sideways, grabbed at the edge", 17, 18, [0.9, 0.5], [0.2, 0.5]],
  ] as const) {
    test(`swaps with the cover under the pointer: ${name}`, async ({ page }) => {
      await loadWall(page);
      const before = await ids(page);
      await drag(page, from, to, [...grab], [...drop]);
      const expected = [...before];
      const moved = expected[from]!;
      expected[from] = expected[to]!;
      expected[to] = moved;
      await expect.poll(() => ids(page)).toEqual(expected);
    });
  }

  test("letting go off the wall swaps nothing", async ({ page }) => {
    await loadWall(page);
    const before = await ids(page);
    const tiles = page.locator("#grid-container [data-album-id]");
    const start = (await tiles.nth(9).boundingBox())!;
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(start.x + 20, start.y + 20, { steps: 3 });
    // Up over the page heading, well clear of every cover.
    await page.mouse.move(640, 20, { steps: 15 });
    await page.mouse.up();
    await expect.poll(() => ids(page)).toEqual(before);
  });

  test("covers do not hop back and forth while dragging along a row", async ({ page }) => {
    await loadWall(page);
    const tiles = page.locator("#grid-container [data-album-id]");
    const start = (await tiles.nth(21).boundingBox())!;
    const end = (await tiles.nth(17).boundingBox())!;
    // Grabbed by the right edge and dragged left: the cover's own center runs ahead of the pointer.
    const x0 = start.x + start.width * 0.9;
    const x1 = end.x + end.width * 0.9;
    const y = start.y + start.height / 2;
    await page.mouse.move(x0, y);
    await page.mouse.down();
    await page.mouse.move(x0 - 12, y, { steps: 3 });
    const seen: number[] = [];
    for (let step = 1; step <= 50; step += 1) {
      await page.mouse.move(x0 + (x1 - x0) * (step / 50), y);
      const displaced = await tiles.evaluateAll((nodes) =>
        nodes
          .map((node, index) => ({ index, moved: (node as HTMLElement).style.transform }))
          .filter(
            (entry) =>
              entry.index !== 21 && entry.moved && !entry.moved.includes("translate3d(0px, 0px")
          )
          .map((entry) => entry.index)
      );
      if (displaced.length > 0) seen.push(displaced[0]!);
    }
    await page.mouse.up();
    // The covers pushed aside go 20, 19, 18, 17 and never back.
    const steps = seen.filter((value, index) => value !== seen[index - 1]);
    expect(steps).toEqual([...steps].sort((a, b) => b - a));
  });
});
