import sharp from "sharp";
import { allowedCoverUrl, createHandler, fetchCover, WIDTHS } from "../lambda/cover-image/index";

const DISCOGS_COVER = "https://i.discogs.com/abc/rs:fit/g:sm/q:90/h:600/w:600/R-1-1.jpeg";
const event = (query: string, path = "/img", method = "GET") => ({
  rawPath: path,
  rawQueryString: query,
  requestContext: { http: { method } },
});
const query = (url: string, w: number | string) =>
  `url=${encodeURIComponent(url)}&w=${encodeURIComponent(String(w))}`;

function cover(width = 800, height = 800) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 40, b: 40 } },
  })
    .jpeg()
    .toBuffer();
}

function imageResponse(body: Buffer, headers: Record<string, string> = {}) {
  return new Response(new Uint8Array(body), {
    status: 200,
    headers: { "content-type": "image/jpeg", ...headers },
  });
}

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("allowed cover addresses", () => {
  it.each([
    DISCOGS_COVER,
    "https://st.discogs.com/abc/images/default-release.png",
    "https://coverartarchive.org/release/1b0e9b6b-2e7d-4c6f-8f2c-1c1f0d6b4f00/front-250",
    "https://archive.org/download/mbid-1/mbid-1-2.jpg",
    "https://ia800100.us.archive.org/12/items/mbid-1/mbid-1-2.jpg",
  ])("allows %s", (url) => {
    expect(allowedCoverUrl(url)?.href).toBe(url);
  });

  it.each([
    "http://i.discogs.com/a.jpg",
    "https://i.discogs.com:8443/a.jpg",
    "https://user:pass@i.discogs.com/a.jpg",
    "https://discogs.com/a.jpg",
    "https://i.discogs.com.evil.example/a.jpg",
    "https://evilarchive.org/a.jpg",
    "https://archive.org.evil.example/a.jpg",
    "https://169.254.169.254/latest/meta-data",
    "https://localhost/a.jpg",
    "file:///etc/passwd",
    "not a url",
    "",
  ])("refuses %s", (url) => {
    expect(allowedCoverUrl(url)).toBeNull();
  });
});

describe("cover image handler", () => {
  it.each(WIDTHS)("returns a square WebP %ipx copy cached for a year", async (width) => {
    const load = jest.fn().mockResolvedValue(await cover(800, 600));
    const response = await createHandler(load)(event(query(DISCOGS_COVER, width)));

    expect(response.statusCode).toBe(200);
    expect(load).toHaveBeenCalledWith(new URL(DISCOGS_COVER));
    expect(response.headers).toMatchObject({
      "content-type": "image/webp",
      "cache-control": "public, max-age=31536000, immutable",
      "access-control-allow-origin": "*",
    });
    expect(response.isBase64Encoded).toBe(true);
    const meta = await sharp(Buffer.from(response.body, "base64")).metadata();
    expect(meta).toMatchObject({ format: "webp", width, height: width });
  });

  it("does not enlarge a small cover", async () => {
    const load = jest.fn().mockResolvedValue(await cover(150, 150));
    const response = await createHandler(load)(event(query(DISCOGS_COVER, 600)));
    const meta = await sharp(Buffer.from(response.body, "base64")).metadata();
    expect(meta.width).toBe(150);
  });

  it.each([
    ["an unlisted width", query(DISCOGS_COVER, 500)],
    ["a width written differently", query(DISCOGS_COVER, "064")],
    ["no width", `url=${encodeURIComponent(DISCOGS_COVER)}`],
    ["no address", "w=64"],
    ["a host that is not allowed", query("https://example.com/a.jpg", 64)],
    ["an extra parameter", `${query(DISCOGS_COVER, 64)}&fit=contain`],
    ["a repeated parameter", `${query(DISCOGS_COVER, 64)}&w=320`],
  ])("refuses %s with 400 without fetching", async (_name, q) => {
    const load = jest.fn();
    const response = await createHandler(load)(event(q));
    expect(response.statusCode).toBe(400);
    expect(response.headers["access-control-allow-origin"]).toBe("*");
    expect(load).not.toHaveBeenCalled();
  });

  it("refuses other paths and methods with 400", async () => {
    const load = jest.fn();
    const handler = createHandler(load);
    expect((await handler(event(query(DISCOGS_COVER, 64), "/w/AbCd1234"))).statusCode).toBe(400);
    expect((await handler(event(query(DISCOGS_COVER, 64), "/img", "POST"))).statusCode).toBe(400);
    expect(load).not.toHaveBeenCalled();
  });

  it("answers 502 without caching when the cover cannot be fetched", async () => {
    const load = jest.fn().mockRejectedValue(new Error("timeout"));
    const response = await createHandler(load)(event(query(DISCOGS_COVER, 64)));
    expect(response.statusCode).toBe(502);
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("answers 422 when the cover is not an image sharp can read", async () => {
    const load = jest.fn().mockResolvedValue(Buffer.from("<html>not an image</html>"));
    const response = await createHandler(load)(event(query(DISCOGS_COVER, 64)));
    expect(response.statusCode).toBe(422);
  });
});

describe("fetching covers", () => {
  const mockFetch = (...responses: Response[]) => {
    const fn = jest.fn();
    for (const response of responses) fn.mockResolvedValueOnce(response);
    global.fetch = fn as unknown as typeof fetch;
    return fn;
  };
  const redirect = (location: string) => new Response(null, { status: 302, headers: { location } });

  it("follows Cover Art Archive's redirects within archive.org", async () => {
    const bytes = await cover();
    const fetchMock = mockFetch(
      redirect("https://archive.org/download/mbid-1/mbid-1-2_thumb250.jpg"),
      redirect("https://ia800100.us.archive.org/12/items/mbid-1/mbid-1-2_thumb250.jpg"),
      imageResponse(bytes)
    );
    const result = await fetchCover(new URL("https://coverartarchive.org/release/1/front-250"));
    expect(result.equals(bytes)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });

  it("tries once more after a server error", async () => {
    const bytes = await cover();
    const fetchMock = mockFetch(new Response("", { status: 500 }), imageResponse(bytes));
    const result = await fetchCover(new URL(DISCOGS_COVER));
    expect(result.equals(bytes)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after a second server error, and does not retry other failures", async () => {
    let fetchMock = mockFetch(new Response("", { status: 503 }), new Response("", { status: 503 }));
    await expect(fetchCover(new URL(DISCOGS_COVER))).rejects.toThrow("503");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock = mockFetch(new Response("", { status: 403 }));
    await expect(fetchCover(new URL(DISCOGS_COVER))).rejects.toThrow("403");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses a redirect to a host that is not allowed", async () => {
    mockFetch(redirect("https://evil.example/a.jpg"));
    await expect(
      fetchCover(new URL("https://coverartarchive.org/release/1/front-250"))
    ).rejects.toThrow("not allowed");
  });

  it("gives up after a few redirects", async () => {
    const loop = Array.from({ length: 10 }, () => redirect("https://archive.org/again"));
    mockFetch(...loop);
    await expect(fetchCover(new URL("https://archive.org/start"))).rejects.toThrow(
      "too many times"
    );
  });

  it("refuses a cover declared or found to be over the size limit", async () => {
    mockFetch(imageResponse(Buffer.alloc(10), { "content-length": "9000000" }));
    await expect(fetchCover(new URL(DISCOGS_COVER))).rejects.toThrow("too large");
    mockFetch(imageResponse(Buffer.alloc(8_000_001)));
    await expect(fetchCover(new URL(DISCOGS_COVER))).rejects.toThrow("too large");
  });

  it("refuses a response that is not an image", async () => {
    mockFetch(new Response("<html></html>", { headers: { "content-type": "text/html" } }));
    await expect(fetchCover(new URL(DISCOGS_COVER))).rejects.toThrow("not an image");
  });

  it("reports a missing cover as not found, cached for an hour", async () => {
    mockFetch(new Response("", { status: 404 }));
    const response = await createHandler(fetchCover)(event(query(DISCOGS_COVER, 64)));
    expect(response.statusCode).toBe(404);
    expect(response.headers["cache-control"]).toBe("public, max-age=3600");
  });
});
