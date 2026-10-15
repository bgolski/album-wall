import { createImageSourcePolicy } from "./imageSourcePolicy";

/**
 * Where cover images come from: the app's own image service, the third-party resizing proxy, or
 * each cover's own address.
 */
export type CoverSource = "service" | "proxy" | "direct";

/** How long a source that keeps failing is skipped before it is tried again. */
const RETRY_AFTER_MS = 60_000;

/** Every source, best first. */
export const ALL_COVER_SOURCES: readonly CoverSource[] = ["service", "proxy", "direct"];

// One policy per step down: the service against what follows it, the proxy against direct loads.
const newPolicies = () => ({
  service: createImageSourcePolicy({ retryAfterMs: RETRY_AFTER_MS, now: () => Date.now() }),
  proxy: createImageSourcePolicy({ retryAfterMs: RETRY_AFTER_MS, now: () => Date.now() }),
});

let policies = newPolicies();
let current: readonly CoverSource[] = ALL_COVER_SOURCES;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function refresh() {
  const serviceUp = policies.service.mode() === "proxy";
  const proxyUp = policies.proxy.mode() === "proxy";
  // Nothing reports about a skipped source, so check back once the wait is over.
  if ((!serviceUp || !proxyUp) && !retryTimer) {
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      refresh();
    }, RETRY_AFTER_MS);
  }
  const next = ALL_COVER_SOURCES.filter(
    (source) => (source !== "service" || serviceUp) && (source !== "proxy" || proxyUp)
  );
  if (next.join() !== current.join()) {
    current = next;
    listeners.forEach((listener) => listener());
  }
}

/**
 * Records whether a cover image loaded, so the page can stop asking a source that is down.
 *
 * @param source Where the image came from.
 * @param ok Whether it loaded.
 */
export function reportCoverLoad(source: CoverSource, ok: boolean): void {
  if (source === "service") policies.service.report("proxy", ok);
  else policies.proxy.report(source, ok);
  refresh();
}

/**
 * Where new cover images should come from right now, best first. Always ends with `"direct"`;
 * the same array is returned until it changes.
 */
export function coverSources(): readonly CoverSource[] {
  return current;
}

/**
 * Calls `listener` whenever {@link coverSources} changes.
 *
 * @param listener Called with no arguments.
 * @returns A function that stops the calls.
 */
export function subscribeToCoverSource(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Starts again from the image service, forgetting every report (for tests). */
export function resetCoverSource(): void {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = undefined;
  policies = newPolicies();
  current = ALL_COVER_SOURCES;
  listeners.forEach((listener) => listener());
}
