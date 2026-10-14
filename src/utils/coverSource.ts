import { createImageSourcePolicy } from "./imageSourcePolicy";

/** Where cover images come from: the resizing image proxy, or each cover's own address. */
export type CoverSource = "proxy" | "direct";

/** How long covers load directly before the proxy is tried again. */
const RETRY_AFTER_MS = 60_000;

let policy = createImageSourcePolicy({ retryAfterMs: RETRY_AFTER_MS, now: () => Date.now() });
let current: CoverSource = "proxy";
let retryTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function refresh() {
  const next = policy.mode();
  // Nothing reports while covers load directly, so check back once the wait is over.
  if (next === "direct" && !retryTimer) {
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      refresh();
    }, RETRY_AFTER_MS);
  }
  if (next !== current) {
    current = next;
    listeners.forEach((listener) => listener());
  }
}

/**
 * Records whether a cover image loaded, so the page can stop asking a proxy that is down.
 *
 * @param source Where the image came from.
 * @param ok Whether it loaded.
 */
export function reportCoverLoad(source: CoverSource, ok: boolean): void {
  policy.report(source, ok);
  refresh();
}

/** Where new cover images should come from right now. */
export function coverSource(): CoverSource {
  return current;
}

/**
 * Calls `listener` whenever {@link coverSource} changes.
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

/** Starts again from the proxy, forgetting every report (for tests). */
export function resetCoverSource(): void {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = undefined;
  policy = createImageSourcePolicy({ retryAfterMs: RETRY_AFTER_MS, now: () => Date.now() });
  current = "proxy";
  listeners.forEach((listener) => listener());
}
