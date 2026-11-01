import { describe, it, expect } from "vitest";
import {
  coverAddresses,
  getProxiedImageUrl,
  getServiceImageUrl,
  DEFAULT_PLACEHOLDER_IMAGE,
} from "./imageProxy";

// Helper to construct a URL with special characters
const urlWithSpecialChars = "https://example.com/cover image.jpg?size=large&color=blue#section";
const proxyPrefix = "https://images.weserv.nl/?url=";

describe("getProxiedImageUrl", () => {
  it("returns the placeholder when no URL is provided", () => {
    const result = getProxiedImageUrl("");
    expect(result).toBe(DEFAULT_PLACEHOLDER_IMAGE);
  });

  it("returns the same data URL unchanged", () => {
    const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgA";
    const result = getProxiedImageUrl(dataUrl);
    expect(result).toBe(dataUrl);
  });

  it("encodes the URL with the weserv proxy", () => {
    const result = getProxiedImageUrl(urlWithSpecialChars);
    expect(result).toBe(`${proxyPrefix}${encodeURIComponent(urlWithSpecialChars)}`);
    // The encoded part should contain %20 for the space
    expect(result).toContain("%20");
  });

  it("requests the original size when no size is given", () => {
    expect(getProxiedImageUrl(urlWithSpecialChars)).not.toContain("&w=");
    expect(getProxiedImageUrl(urlWithSpecialChars, {})).not.toContain("&w=");
  });

  it("asks the proxy for a square of the given size", () => {
    const result = getProxiedImageUrl(urlWithSpecialChars, { size: 320 });
    expect(result).toBe(
      `${proxyPrefix}${encodeURIComponent(urlWithSpecialChars)}&w=320&h=320&fit=cover`
    );
  });

  it("gives the same URL every time for the same cover and size", () => {
    expect(getProxiedImageUrl(urlWithSpecialChars, { size: 320 })).toBe(
      getProxiedImageUrl(urlWithSpecialChars, { size: 320 })
    );
  });

  it("leaves data URLs and the placeholder alone when a size is given", () => {
    const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgA";
    expect(getProxiedImageUrl(dataUrl, { size: 320 })).toBe(dataUrl);
    expect(getProxiedImageUrl("", { size: 320 })).toBe(DEFAULT_PLACEHOLDER_IMAGE);
  });
});

describe("getServiceImageUrl", () => {
  const discogs = "https://i.discogs.com/abc/R-1-1.jpeg";
  const service = `https://albumwall.bradleygolski.com/img?url=${encodeURIComponent(discogs)}`;

  it("asks the image service for the smallest width it makes that is big enough", () => {
    expect(getServiceImageUrl(discogs, { size: 64 })).toBe(`${service}&w=64`);
    expect(getServiceImageUrl(discogs, { size: 96 })).toBe(`${service}&w=320`);
    expect(getServiceImageUrl(discogs, { size: 320 })).toBe(`${service}&w=320`);
    expect(getServiceImageUrl(discogs, { size: 400 })).toBe(`${service}&w=600`);
    expect(getServiceImageUrl(discogs, { size: 2000 })).toBe(`${service}&w=600`);
    expect(getServiceImageUrl(discogs)).toBe(`${service}&w=600`);
  });

  it("serves Discogs and Cover Art Archive covers only", () => {
    expect(getServiceImageUrl("https://coverartarchive.org/release/1/front-250")).not.toBeNull();
    expect(getServiceImageUrl("https://ia800100.us.archive.org/1/items/a/a.jpg")).not.toBeNull();
    expect(getServiceImageUrl("https://example.com/cover.jpg")).toBeNull();
    expect(getServiceImageUrl("http://i.discogs.com/a.jpg")).toBeNull();
    expect(getServiceImageUrl("https://i.discogs.com.evil.example/a.jpg")).toBeNull();
    expect(getServiceImageUrl("data:image/png;base64,AAAA")).toBeNull();
    expect(getServiceImageUrl("")).toBeNull();
  });
});

describe("coverAddresses", () => {
  const discogs = "https://i.discogs.com/abc/R-1-1.jpeg";

  it("lists the service copy, the proxy copy and the original, in the order given", () => {
    expect(coverAddresses(discogs, ["service", "proxy", "direct"], { size: 320 })).toEqual([
      { src: getServiceImageUrl(discogs, { size: 320 }), source: "service" },
      { src: getProxiedImageUrl(discogs, { size: 320 }), source: "proxy" },
      { src: discogs, source: "direct" },
    ]);
  });

  it("leaves out the service for a cover it does not serve, and skipped sources", () => {
    const other = "https://example.com/cover.jpg";
    expect(coverAddresses(other, ["service", "proxy", "direct"]).map((a) => a.source)).toEqual([
      "proxy",
      "direct",
    ]);
    expect(coverAddresses(discogs, ["direct"])).toEqual([{ src: discogs, source: "direct" }]);
    expect(coverAddresses("", ["service", "proxy", "direct"])).toEqual([]);
  });
});
