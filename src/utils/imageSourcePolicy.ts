/**
 * Policy for determining whether to fetch album images via the proxy or directly from the CDN.
 *
 * The policy is a tiny finite‑state machine with three states:
 *   * **proxy** – use the proxy. Reset failure counter on success.
 *   * **direct** – use the direct CDN. Ignored reports until the retry interval expires.
 *   * **probing** – temporary state after the retry interval that attempts to use the proxy
 *     again. A succeeding proxy request returns to **proxy**; a failing one returns to
 *     **direct**.
 *
 * The default configuration mirrors the production behaviour:
 *   * `failureThreshold` = 4 consecutive proxy failures before falling back to direct.
 *   * `retryAfterMs` = 60 000 ms (1 minute) before the proxy is probed again.
 *   * `now()` defaults to `Date.now`.
 *
 * @returns An object with `report(kind, ok)` and `mode()` methods.
 */
export function createImageSourcePolicy(options?: {
  /**
   * Number of consecutive proxy failures before switching to direct.
   * @default 4
   */
  failureThreshold?: number;
  /**
   * Milliseconds to wait after switching to direct before probing the proxy again.
   * @default 60000
   */
  retryAfterMs?: number;
  /**
   * Function returning the current timestamp in milliseconds. Useful for tests.
   * @default Date.now
   */
  now?: () => number;
}) {
  const { failureThreshold = 4, retryAfterMs = 60_000, now = Date.now } = options ?? {};

  let state: "proxy" | "direct" | "probing" = "proxy";
  let failures = 0;
  let switchedAt = 0; // time when switched to direct

  /**
   * Record the result of an image fetch attempt.
   * @param kind "proxy" if the request went through the proxy, "direct" otherwise.
   * @param ok true if the request succeeded, false if it failed.
   */
  function report(kind: "proxy" | "direct", ok: boolean): void {
    // If in direct mode, check if the retry interval has elapsed
    // and transition to probing; otherwise ignore the report.
    if (state === "direct") {
      if (now() - switchedAt >= retryAfterMs) {
        state = "probing";
      } else {
        return;
      }
    }

    switch (state) {
      case "proxy": {
        if (kind === "proxy") {
          if (ok) {
            failures = 0;
          } else {
            failures += 1;
            if (failures >= failureThreshold) {
              state = "direct";
              switchedAt = now();
            }
          }
        }
        // ignore direct reports while in proxy state
        break;
      }

      case "probing": {
        if (kind === "proxy") {
          if (ok) {
            state = "proxy";
            failures = 0;
          } else {
            state = "direct";
            switchedAt = now();
          }
        }
        // ignore direct reports while probing
        break;
      }
    }
  }

  /**
   * Current image source mode.
   * @returns "proxy" or "direct".
   */
  function mode(): "proxy" | "direct" {
    if (state === "direct") {
      const elapsed = now() - switchedAt;
      if (elapsed >= retryAfterMs) {
        state = "probing";
      }
    }
    return state === "direct" ? "direct" : "proxy";
  }

  return { report, mode };
}
