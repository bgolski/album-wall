import sharp from "sharp";
import {
  MAX_URLS,
  MEASURE_LIMIT,
  createHandler,
  parseUrls,
  profileOfCover,
  type ProfileStore,
} from "../lambda/cover-profiles/index";

const cover = (name: string) => `https://i.discogs.com/${name}.jpeg`;

function post(urls: unknown, method = "POST") {
  return { requestContext: { http: { method } }, body: JSON.stringify({ urls }) };
}

const packed = (l: number) => ({ c: [l, 0, 0], p: [[l, 0, 0, 1]], r: [[l, 0, 0]] });

function fakeStore(kept: Record<string, number> = {}) {
  const saved: string[] = [];
  const measured: string[] = [];
  const store: ProfileStore = {
    read: async (urls) =>
      new Map(urls.filter((url) => url in kept).map((url) => [url, packed(kept[url]!)])),
    measure: async (url) => {
      measured.push(url.href);
      return url.href.includes("broken") ? null : packed(0.5);
    },
    save: async (url) => {
      saved.push(url);
    },
  };
  return { store, saved, measured };
}

async function bodyOf(handler: ReturnType<typeof createHandler>, event: object) {
  const response = await handler(event);
  return { response, body: JSON.parse(response.body) as { profiles?: Record<string, unknown> } };
}

describe("parseUrls", () => {
  it("keeps distinct allowed covers and drops the rest", () => {
    const result = parseUrls(
      post([cover("a"), cover("a"), "https://evil.example/x.jpg", 5, "not a url"])
    );
    expect((result as URL[]).map((url) => url.href)).toEqual([cover("a")]);
  });

  it("refuses a body that is not JSON, has no list, or lists too many", () => {
    expect(parseUrls({ body: "nope" })).toEqual(expect.any(String));
    expect(parseUrls({ body: JSON.stringify({ urls: "x" }) })).toEqual(expect.any(String));
    expect(
      parseUrls(post(Array.from({ length: MAX_URLS + 1 }, (_, i) => cover(String(i)))))
    ).toEqual(expect.any(String));
  });

  it("reads a base64 body", () => {
    const body = Buffer.from(JSON.stringify({ urls: [cover("a")] })).toString("base64");
    expect(parseUrls({ body, isBase64Encoded: true })).toHaveLength(1);
  });
});

describe("the profile service", () => {
  it("answers with kept profiles without measuring anything", async () => {
    const { store, measured, saved } = fakeStore({ [cover("a")]: 0.1, [cover("b")]: 0.2 });
    const { response, body } = await bodyOf(createHandler(store), post([cover("a"), cover("b")]));
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(Object.keys(body.profiles!).sort()).toEqual([cover("a"), cover("b")]);
    expect(measured).toEqual([]);
    expect(saved).toEqual([]);
  });

  it("measures and keeps the covers that are missing", async () => {
    const { store, measured, saved } = fakeStore({ [cover("a")]: 0.1 });
    const { body } = await bodyOf(createHandler(store), post([cover("a"), cover("b")]));
    expect(measured).toEqual([cover("b")]);
    expect(saved).toEqual([cover("b")]);
    expect(Object.keys(body.profiles!).sort()).toEqual([cover("a"), cover("b")]);
  });

  it("leaves out a cover that cannot be measured, and keeps nothing for it", async () => {
    const { store, saved } = fakeStore();
    const { body } = await bodyOf(createHandler(store), post([cover("broken"), cover("fine")]));
    expect(Object.keys(body.profiles!)).toEqual([cover("fine")]);
    expect(saved).toEqual([cover("fine")]);
  });

  it("measures at most a few covers per request and leaves the rest for the browser", async () => {
    const { store, measured } = fakeStore();
    const urls = Array.from({ length: MEASURE_LIMIT + 5 }, (_, at) => cover(`c${at}`));
    const { body } = await bodyOf(createHandler(store), post(urls));
    expect(measured).toHaveLength(MEASURE_LIMIT);
    expect(Object.keys(body.profiles!)).toHaveLength(MEASURE_LIMIT);
  });

  it("keeps working when keeping a profile fails", async () => {
    const { store } = fakeStore();
    store.save = async () => {
      throw new Error("throttled");
    };
    const { body } = await bodyOf(createHandler(store), post([cover("a")]));
    expect(Object.keys(body.profiles!)).toEqual([cover("a")]);
  });

  it("refuses other methods and bad bodies", async () => {
    const { store } = fakeStore();
    const handler = createHandler(store);
    expect((await handler(post([], "GET"))).statusCode).toBe(405);
    expect((await handler({ body: "{" })).statusCode).toBe(400);
  });
});

describe("profileOfCover", () => {
  const solid = (r: number, g: number, b: number) =>
    sharp({ create: { width: 120, height: 90, channels: 3, background: { r, g, b } } })
      .png()
      .toBuffer();

  it("gives a red cover a red profile with nine region colors", async () => {
    const profile = (await profileOfCover(await solid(220, 20, 20)))!;
    expect(profile.r).toHaveLength(9);
    // OKLab a (red-green axis) is clearly positive for red.
    expect(profile.c[1]!).toBeGreaterThan(0.1);
    expect(profile.p.length).toBeGreaterThan(0);
  });

  it("tells a dark cover from a light one", async () => {
    const dark = (await profileOfCover(await solid(10, 10, 10)))!;
    const light = (await profileOfCover(await solid(245, 245, 245)))!;
    expect(light.c[0]!).toBeGreaterThan(dark.c[0]! + 0.5);
  });
});
