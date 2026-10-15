import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readCoverProfile } from "./readCoverProfile";
import { reportCoverLoad, resetCoverSource } from "./coverSource";

// jsdom does not load images or draw canvases, so both are replaced with small stand-ins.
class FakeImage {
  static last: FakeImage | null = null;
  crossOrigin = "";
  src = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    FakeImage.last = this;
  }
}

let pixels: Uint8ClampedArray;
let readable = true;

beforeEach(() => {
  vi.stubGlobal("Image", FakeImage);
  pixels = new Uint8ClampedArray(64 * 64 * 4).fill(255);
  readable = true;
  vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
    if (tag !== "canvas") throw new Error("unexpected element");
    return {
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: () => {},
        getImageData: () => {
          if (!readable) throw new Error("tainted");
          return { data: pixels };
        },
      }),
    };
  }) as unknown as typeof document.createElement);
});

afterEach(() => {
  resetCoverSource();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("readCoverProfile", () => {
  it("asks the proxy for a 64 pixel copy it may read, and returns its color", async () => {
    const result = readCoverProfile("https://example.test/cover.jpg");
    const image = FakeImage.last!;
    expect(image.crossOrigin).toBe("anonymous");
    expect(image.src).toContain("images.weserv.nl");
    expect(image.src).toContain("w=64");
    image.onload!();
    const profile = await result;
    expect(profile!.color.l).toBeCloseTo(1, 3); // opaque white
    expect(profile!.regions).toHaveLength(9);
  });

  it("retries at the tile size when the small copy does not load", async () => {
    const result = readCoverProfile("https://example.test/cover.jpg");
    const small = FakeImage.last!;
    small.onerror!();
    await Promise.resolve();
    const tile = FakeImage.last!;
    expect(tile).not.toBe(small);
    expect(tile.src).toContain("w=320");
    tile.onload!();
    expect((await result)!.color.l).toBeCloseTo(1, 3);
  });

  it("gives null when neither copy loads", async () => {
    const result = readCoverProfile("https://example.test/cover.jpg");
    FakeImage.last!.onerror!();
    await Promise.resolve();
    FakeImage.last!.onerror!();
    expect(await result).toBeNull();
  });

  it("gives null, without a retry, when the pixels are not readable", async () => {
    readable = false;
    const result = readCoverProfile("https://example.test/cover.jpg");
    const first = FakeImage.last!;
    first.onload!();
    expect(await result).toBeNull();
    expect(FakeImage.last).toBe(first);
  });

  it("gives null for an empty address without loading anything", async () => {
    FakeImage.last = null;
    expect(await readCoverProfile("")).toBeNull();
    expect(FakeImage.last).toBeNull();
  });

  it("gives up on each copy after the time limit", async () => {
    vi.useFakeTimers();
    const result = readCoverProfile("https://example.test/cover.jpg", 500);
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(500);
    expect(await result).toBeNull();
  });

  it("ignores a load that arrives after giving up on that copy", async () => {
    vi.useFakeTimers();
    const result = readCoverProfile("https://example.test/cover.jpg", 100);
    const small = FakeImage.last!;
    await vi.advanceTimersByTimeAsync(100);
    small.onload?.();
    await vi.advanceTimersByTimeAsync(100);
    expect(await result).toBeNull();
  });

  it("reads a Discogs cover from the app's image service first, then the proxy", async () => {
    const result = readCoverProfile("https://i.discogs.com/abc/R-1-1.jpeg");
    const service = FakeImage.last!;
    expect(service.src).toContain("albumwall.bradleygolski.com/img?");
    expect(service.src).toContain("&w=64");
    service.onerror!();
    await Promise.resolve();
    const proxy = FakeImage.last!;
    expect(proxy.src).toContain("images.weserv.nl");
    expect(proxy.src).toContain("w=64");
    proxy.onload!();
    expect((await result)!.color.l).toBeCloseTo(1, 3);
  });

  it("uses only the image service while the proxy is being skipped", async () => {
    for (let i = 0; i < 4; i += 1) reportCoverLoad("proxy", false);
    const result = readCoverProfile("https://i.discogs.com/abc/R-1-1.jpeg");
    const service = FakeImage.last!;
    service.onerror!();
    expect(await result).toBeNull();
    expect(FakeImage.last).toBe(service);
  });
});
