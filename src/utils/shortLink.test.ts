import { afterEach, describe, expect, it, vi } from "vitest";
import { requestShortLink, type ShortLinkRequest } from "./shortLink";

const request: ShortLinkRequest = {
  payload: "AgQI",
  app: "https://bradleygolski.com/album-wall/",
  title: "someone's Album Wall",
  rows: 4,
  columns: 8,
  covers: [],
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("requestShortLink", () => {
  it("posts the wall to the proxy's share address and returns the short link", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ url: "https://d111.cloudfront.net/w/AbCd1234" }));
    const url = await requestShortLink(request, "https://example.test/discogs-proxy/");
    expect(url).toBe("https://d111.cloudfront.net/w/AbCd1234");
    const [address, init] = fetchMock.mock.calls[0]!;
    expect(String(address)).toBe("https://example.test/discogs-proxy/share");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual(request);
  });

  it("returns null without a proxy, on an error, or for an answer that is not a short link", async () => {
    expect(await requestShortLink(request, "")).toBeNull();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("no", { status: 503 }));
    expect(await requestShortLink(request, "https://example.test/")).toBeNull();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({ url: "https://evil.example/phish" })
    );
    expect(await requestShortLink(request, "https://example.test/")).toBeNull();
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("offline"));
    expect(await requestShortLink(request, "https://example.test/")).toBeNull();
  });

  it("gives up after a few seconds", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_, init) =>
        new Promise((_, reject) =>
          init?.signal?.addEventListener("abort", () => reject(new DOMException("", "AbortError")))
        )
    );
    const result = requestShortLink(request, "https://example.test/");
    await vi.advanceTimersByTimeAsync(3000);
    expect(await result).toBeNull();
  });
});
