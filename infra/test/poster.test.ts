import sharp from "sharp";
import {
  capKey,
  createPosterHandler,
  parsePosterRequest,
  posterLayout,
  recordSvg,
  renderPoster,
  SIZES,
  type PosterRequest,
} from "../lambda/poster/index";

const COVER = "https://i.discogs.com/abc/rs:fit/g:sm/q:90/h:600/w:600/R-1-1.jpeg";
const request = (overrides: Partial<PosterRequest> = {}): PosterRequest => ({
  size: "18x24",
  background: "dark",
  rows: 2,
  columns: 2,
  covers: [COVER, COVER, "", COVER],
  ...overrides,
});
const body = (value: unknown) => ({
  body: JSON.stringify(value),
  requestContext: { http: { method: "POST" } },
});

// The pixels of a patch of the picture (stats() reads the whole image unless it is cut out first).
const patch = async (
  jpeg: Buffer,
  area: { left: number; top: number; width: number; height: number }
) => sharp(await sharp(jpeg).extract(area).toBuffer()).stats();

describe("parsePosterRequest", () => {
  it("accepts a wall with a cover address or nothing for each spot", () => {
    expect(parsePosterRequest(JSON.stringify(request()))).toEqual(request());
  });

  it.each([
    ["an unknown size", { size: "40x60" }],
    ["an unknown background", { background: "red" }],
    ["fractional rows", { rows: 1.5 }],
    ["too many spots", { rows: 20, columns: 20, covers: Array(400).fill("") }],
    ["the wrong number of covers", { covers: [COVER] }],
    [
      "a cover from a host that is not allowed",
      { covers: ["https://evil.example/a.jpg", "", "", ""] },
    ],
    ["a cover that is not an address", { covers: ["nope", "", "", ""] }],
  ])("refuses %s", (_name, change) => {
    expect(typeof parsePosterRequest(JSON.stringify({ ...request(), ...change }))).toBe("string");
  });

  it("refuses text that is not JSON, and a body that is too large", () => {
    expect(parsePosterRequest("{")).toBe("Expected JSON.");
    expect(parsePosterRequest(" ".repeat(70_000))).toBe("Request is too large.");
  });
});

describe("posterLayout", () => {
  it("keeps a margin of 5% and centres the wall, with square tiles", () => {
    const layout = posterLayout({ size: "18x24", rows: 4, columns: 4 });
    expect([layout.width, layout.height]).toEqual([5400, 7200]);
    const wall = 4 * layout.tile + 3 * layout.gap;
    expect(wall).toBeLessThanOrEqual(5400 - 2 * 270);
    expect(layout.left).toBe(Math.round((5400 - wall) / 2));
    expect(layout.top).toBe(Math.round((7200 - wall) / 2));
  });

  it("turns the poster sideways for a wide wall", () => {
    const layout = posterLayout({ size: "24x36", rows: 4, columns: 8 });
    expect([layout.width, layout.height]).toEqual([10800, 7200]);
    expect(layout.top).toBeGreaterThan(0);
  });

  it("makes the large size 4/3 as wide as the small one", () => {
    expect(SIZES["24x36"].short / SIZES["18x24"].short).toBeCloseTo(4 / 3);
  });
});

describe("recordSvg", () => {
  it("is rings out to the corners and two bands of light, at the poster's size", () => {
    const svg = recordSvg(5400, 7200);
    expect(svg).toContain('width="5400" height="7200"');
    expect((svg.match(/<circle/g) ?? []).length).toBeGreaterThan(50);
    expect((svg.match(/<path/g) ?? []).length).toBeGreaterThan(20);
  });
});

describe("renderPoster", () => {
  jest.setTimeout(120_000);
  const cover = (r: number) =>
    sharp({ create: { width: 600, height: 600, channels: 3, background: { r, g: 40, b: 40 } } })
      .jpeg()
      .toBuffer();

  it("draws the covers at their places on a poster of the right size, leaving out one that fails", async () => {
    const red = await cover(200);
    const load = jest.fn(async (url: URL) => {
      if (url.href.includes("missing")) throw new Error("gone");
      return red;
    });
    const small = request({
      size: "18x24",
      rows: 2,
      columns: 2,
      covers: [COVER, "https://i.discogs.com/missing.jpg", "", COVER],
    });
    const { jpeg, left, width, height } = await renderPoster(small, load);

    expect(left).toBe(1);
    // The same cover twice is fetched once.
    expect(load).toHaveBeenCalledTimes(2);
    const info = await sharp(jpeg).metadata();
    expect([info.width, info.height, info.format]).toEqual([width, height, "jpeg"]);
    expect([width, height]).toEqual([5400, 7200]);

    // The first spot is red (the cover), and the margin is the dark background.
    const layout = posterLayout(small);
    const spot = await patch(jpeg, {
      left: layout.left + 200,
      top: layout.top + 200,
      width: 4,
      height: 4,
    });
    expect(spot.channels[0]!.mean).toBeGreaterThan(150);
    const margin = await patch(jpeg, { left: 20, top: 20, width: 4, height: 4 });
    expect(margin.channels[0]!.mean).toBeLessThan(30);
  });

  it("draws the record behind the wall when asked", async () => {
    const red = await cover(200);
    const { jpeg } = await renderPoster(
      request({ background: "record", covers: ["", "", "", ""] }),
      async () => red
    );
    // Rings change the pixels across the margin, where a plain background is one flat colour.
    const strip = await patch(jpeg, { left: 0, top: 0, width: 2000, height: 2 });
    expect(strip.channels[2]!.stdev).toBeGreaterThan(0.3);
  });
});

describe("capKey", () => {
  it("is one key for each day, in UTC", () => {
    expect(capKey(new Date("2026-10-20T23:59:59Z"))).toBe("poster-cap:2026-10-20");
    expect(capKey(new Date("2026-10-21T00:00:00Z"))).toBe("poster-cap:2026-10-21");
  });
});

describe("the poster handler", () => {
  const render = jest.fn(async () => ({ jpeg: Buffer.from("jpeg"), left: 2, width: 1, height: 1 }));
  beforeEach(() => {
    render.mockClear();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("answers the preflight for the app's pages", async () => {
    const handler = createPosterHandler({ takeSlot: async () => true, render });
    const result = await handler({ requestContext: { http: { method: "OPTIONS" } } });
    expect(result.statusCode).toBe(204);
    expect(result.headers["access-control-allow-methods"]).toContain("POST");
  });

  it("makes the poster, and says how many covers were left out", async () => {
    const handler = createPosterHandler({ takeSlot: async () => true, render });
    const result = await handler(body(request()));
    expect(result.statusCode).toBe(200);
    expect(result.headers["content-type"]).toBe("image/jpeg");
    expect(result.headers["x-covers-left-out"]).toBe("2");
    expect(result.headers["cache-control"]).toBe("no-store");
    expect(result.body).toEqual(Buffer.from("jpeg"));
  });

  it("reads a body the platform encoded", async () => {
    const handler = createPosterHandler({ takeSlot: async () => true, render });
    const result = await handler({
      body: Buffer.from(JSON.stringify(request())).toString("base64"),
      isBase64Encoded: true,
      requestContext: { http: { method: "POST" } },
    });
    expect(result.statusCode).toBe(200);
  });

  it("refuses a bad request before it uses up a poster", async () => {
    const takeSlot = jest.fn(async () => true);
    const handler = createPosterHandler({ takeSlot, render });
    const result = await handler(body({ ...request(), size: "1x1" }));
    expect(result.statusCode).toBe(400);
    expect(takeSlot).not.toHaveBeenCalled();
    expect(render).not.toHaveBeenCalled();
  });

  it("stops when the day's posters are used up, without drawing anything", async () => {
    const handler = createPosterHandler({ takeSlot: async () => false, render });
    const result = await handler(body(request()));
    expect(result.statusCode).toBe(429);
    expect(render).not.toHaveBeenCalled();
  });

  it("does not draw when the counter cannot be reached, so the cap cannot be skipped", async () => {
    const handler = createPosterHandler({
      takeSlot: async () => {
        throw new Error("down");
      },
      render,
    });
    expect((await handler(body(request()))).statusCode).toBe(503);
    expect(render).not.toHaveBeenCalled();
  });

  it("reports a poster that could not be drawn", async () => {
    const handler = createPosterHandler({
      takeSlot: async () => true,
      render: async () => {
        throw new Error("boom");
      },
    });
    expect((await handler(body(request()))).statusCode).toBe(500);
  });

  it("only takes POST", async () => {
    const handler = createPosterHandler({ takeSlot: async () => true, render });
    expect((await handler({ requestContext: { http: { method: "GET" } } })).statusCode).toBe(405);
  });
});
