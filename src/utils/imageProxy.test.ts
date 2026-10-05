import { describe, it, expect } from "vitest";
import { getProxiedImageUrl, DEFAULT_PLACEHOLDER_IMAGE } from "./imageProxy";

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
