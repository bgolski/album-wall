import { afterEach, describe, expect, it, vi } from "vitest";
import {
  coverSource,
  reportCoverLoad,
  resetCoverSource,
  subscribeToCoverSource,
} from "./coverSource";

afterEach(() => {
  resetCoverSource();
  vi.useRealTimers();
});

describe("coverSource", () => {
  it("starts on the proxy and stays there while it works", () => {
    expect(coverSource()).toBe("proxy");
    reportCoverLoad("proxy", false);
    reportCoverLoad("proxy", true);
    expect(coverSource()).toBe("proxy");
  });

  it("switches to direct after a run of proxy failures and tells subscribers once", () => {
    const listener = vi.fn();
    const stop = subscribeToCoverSource(listener);
    for (let i = 0; i < 4; i += 1) reportCoverLoad("proxy", false);
    expect(coverSource()).toBe("direct");
    expect(listener).toHaveBeenCalledTimes(1);
    reportCoverLoad("proxy", false);
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
  });

  it("tries the proxy again after a minute without anyone reporting", () => {
    vi.useFakeTimers();
    for (let i = 0; i < 4; i += 1) reportCoverLoad("proxy", false);
    const listener = vi.fn();
    const stop = subscribeToCoverSource(listener);
    vi.advanceTimersByTime(59_999);
    expect(coverSource()).toBe("direct");
    vi.advanceTimersByTime(1);
    expect(coverSource()).toBe("proxy");
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
  });

  it("stops calling a listener that unsubscribed", () => {
    const listener = vi.fn();
    subscribeToCoverSource(listener)();
    for (let i = 0; i < 4; i += 1) reportCoverLoad("proxy", false);
    expect(listener).not.toHaveBeenCalled();
  });
});
