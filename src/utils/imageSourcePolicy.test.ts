import { describe, expect, it } from "vitest";
import { createImageSourcePolicy } from "./imageSourcePolicy";

function setup(options: { failureThreshold?: number; retryAfterMs?: number } = {}) {
  const clock = { now: 1_000_000 };
  const policy = createImageSourcePolicy({ ...options, now: () => clock.now });
  const fail = (count = 1) => {
    for (let i = 0; i < count; i += 1) policy.report("proxy", false);
  };
  return { clock, policy, fail };
}

describe("createImageSourcePolicy", () => {
  it("starts on the proxy", () => {
    expect(setup().policy.mode()).toBe("proxy");
  });

  it("stays on the proxy while failures do not run four in a row", () => {
    const { policy, fail } = setup();
    fail(3);
    policy.report("proxy", true);
    fail(3);
    expect(policy.mode()).toBe("proxy");
  });

  it("switches to direct after four failures in a row", () => {
    const { policy, fail } = setup();
    fail(4);
    expect(policy.mode()).toBe("direct");
  });

  it("ignores direct reports and proxy reports that arrive while waiting", () => {
    const { clock, policy, fail } = setup();
    fail(4);
    policy.report("direct", true);
    policy.report("direct", false);
    clock.now += 10_000;
    policy.report("proxy", true);
    expect(policy.mode()).toBe("direct");
  });

  it("tries the proxy again after the wait", () => {
    const { clock, policy, fail } = setup();
    fail(4);
    clock.now += 59_999;
    expect(policy.mode()).toBe("direct");
    clock.now += 1;
    expect(policy.mode()).toBe("proxy");
  });

  it("stays on the proxy when the probe succeeds and starts counting failures afresh", () => {
    const { clock, policy, fail } = setup();
    fail(4);
    clock.now += 60_000;
    policy.report("proxy", true);
    expect(policy.mode()).toBe("proxy");
    fail(3);
    expect(policy.mode()).toBe("proxy");
  });

  it("goes back to direct when the probe fails and waits the full time again", () => {
    const { clock, policy, fail } = setup();
    fail(4);
    clock.now += 60_000;
    expect(policy.mode()).toBe("proxy");
    fail(1);
    expect(policy.mode()).toBe("direct");
    clock.now += 59_999;
    expect(policy.mode()).toBe("direct");
    clock.now += 1;
    expect(policy.mode()).toBe("proxy");
  });

  it("takes a different failure count and wait from the options", () => {
    const { clock, policy, fail } = setup({ failureThreshold: 2, retryAfterMs: 1_000 });
    fail(1);
    expect(policy.mode()).toBe("proxy");
    fail(1);
    expect(policy.mode()).toBe("direct");
    clock.now += 999;
    expect(policy.mode()).toBe("direct");
    clock.now += 1;
    expect(policy.mode()).toBe("proxy");
  });
});
