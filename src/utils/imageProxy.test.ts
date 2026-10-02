import { describe, it, expect } from "vitest";
import { getProxiedImageUrl, DEFAULT_PLACEHOLDER_IMAGE } from "./imageProxy";

// Helper to construct a URL with special characters
const urlWithSpecialChars = "https://example.com/cover image.jpg?size=large&color=blue#section";

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

  it("encodes the URL with the default weserv proxy", () => {
    const result = getProxiedImageUrl(urlWithSpecialChars, 0);
    // weserv URL should start with the proxy service and an encoded URL
    expect(result).toMatch(/^https:\/\/images\.weserv\.nl\/\?url=/);
    // The encoded part should contain %20 for the space
    expect(result).toContain("%20");
    // The decoded part should match the original URL
    const encoded = result.split("=")[1];
    expect(decodeURIComponent(encoded)).toBe(urlWithSpecialChars);
  });

  it("appends the URL without encoding for other proxies", () => {
    const result = getProxiedImageUrl(urlWithSpecialChars, 1);
    expect(result).toBe(`https://cors-anywhere.herokuapp.com/${urlWithSpecialChars}`);
  });

  it("uses the last proxy when the index is out of range", () => {
    const result = getProxiedImageUrl(urlWithSpecialChars, 10);
    expect(result).toBe(`https://api.allorigins.win/raw?url=${urlWithSpecialChars}`);
  });
});
