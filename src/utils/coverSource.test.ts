import { afterEach, describe, expect, it, vi } from "vitest";
import {
  coverSources,
  reportCoverLoad,
  resetCoverSource,
  subscribeToCoverSource,
} from "./coverSource";

afterEach(() => {
  resetCoverSource();
  vi.useRealTimers();
});

const fail = (source: "service" | "proxy", times = 4) => {
  for (let i = 0; i < times; i += 1) reportCoverLoad(source, false);
};

describe("coverSources", () => {
  it("starts with the image service, then the proxy, then direct loads", () => {
    expect(coverSources()).toEqual(["service", "proxy", "direct"]);
    reportCoverLoad("service", false);
    reportCoverLoad("service", true);
    reportCoverLoad("proxy", false);
    expect(coverSources()).toEqual(["service", "proxy", "direct"]);
  });

  it("returns the same list until it changes", () => {
    const first = coverSources();
    reportCoverLoad("service", true);
    expect(coverSources()).toBe(first);
  });

  it("skips the image service after a run of failures, keeping the proxy", () => {
    const listener = vi.fn();
    const stop = subscribeToCoverSource(listener);
    fail("service");
    expect(coverSources()).toEqual(["proxy", "direct"]);
    expect(listener).toHaveBeenCalledTimes(1);
    fail("service", 1);
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
  });

  it("goes direct once both have failed, and tells subscribers each time", () => {
    const listener = vi.fn();
    const stop = subscribeToCoverSource(listener);
    fail("service");
    fail("proxy");
    expect(coverSources()).toEqual(["direct"]);
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
  });

  it("does not count direct loads against either service", () => {
    for (let i = 0; i < 10; i += 1) reportCoverLoad("direct", false);
    expect(coverSources()).toEqual(["service", "proxy", "direct"]);
  });

  it("tries a skipped source again after a minute without anyone reporting", () => {
    vi.useFakeTimers();
    fail("service");
    fail("proxy");
    const listener = vi.fn();
    const stop = subscribeToCoverSource(listener);
    vi.advanceTimersByTime(59_999);
    expect(coverSources()).toEqual(["direct"]);
    vi.advanceTimersByTime(1);
    expect(coverSources()).toEqual(["service", "proxy", "direct"]);
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
  });

  it("skips the service again when the retry fails", () => {
    vi.useFakeTimers();
    fail("service");
    vi.advanceTimersByTime(60_000);
    expect(coverSources()).toEqual(["service", "proxy", "direct"]);
    reportCoverLoad("service", false);
    expect(coverSources()).toEqual(["proxy", "direct"]);
  });

  it("stops calling a listener that unsubscribed", () => {
    const listener = vi.fn();
    subscribeToCoverSource(listener)();
    fail("service");
    expect(listener).not.toHaveBeenCalled();
  });
});
