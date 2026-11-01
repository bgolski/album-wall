import { unpackProfile } from "./colorCache";
import { mostNoticeableColor, type CoverProfile } from "./coverProfile";

/** Where cover colors measured by other visitors are kept; unset when there is no such service. */
export const profileServiceUrl = process.env.NEXT_PUBLIC_PROFILE_SERVICE_URL;

/** Covers asked about in one request: what the service answers at once. */
const BATCH_SIZE = 100;
// Long enough for the service to measure a few covers it has not seen, short enough that a stalled
// service costs little before the covers are measured here.
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Asks the cover color service for profiles other visitors' covers already have, in batches. The
 * service only ever answers for covers it has (measuring a few it lacks itself); covers it does
 * not return are left for this browser to measure. A failure ends the asking and returns what was
 * received so far, so the service can only ever save work.
 *
 * @param options.serviceUrl The service address; defaults to the app's configured one.
 * @param options.signal Cancels the asking.
 * @param options.fetcher Replaces `fetch`, for tests.
 * @returns Profiles by cover address, using the app's current rule for each cover's main color.
 */
export async function fetchSharedProfiles(
  urls: string[],
  options: { serviceUrl?: string | undefined; signal?: AbortSignal; fetcher?: typeof fetch } = {}
): Promise<Map<string, CoverProfile>> {
  const { serviceUrl = profileServiceUrl, signal, fetcher = fetch } = options;
  const found = new Map<string, CoverProfile>();
  if (!serviceUrl) return found;

  for (let start = 0; start < urls.length; start += BATCH_SIZE) {
    if (signal?.aborted) break;
    const batch = urls.slice(start, start + BATCH_SIZE);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const cancel = () => controller.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    try {
      const response = await fetcher(serviceUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ urls: batch }),
        signal: controller.signal,
      });
      if (!response.ok) break;
      const { profiles } = (await response.json()) as { profiles?: Record<string, unknown> };
      if (typeof profiles !== "object" || profiles === null) break;
      for (const url of batch) {
        const profile = unpackProfile(profiles[url]);
        if (!profile) continue;
        // The main color follows the rule in this version of the app, not the one that measured it.
        if (profile.palette.length > 0) {
          profile.color = mostNoticeableColor(
            [...profile.palette].sort((x, y) => y.share - x.share)
          );
        }
        found.set(url, profile);
      }
    } catch {
      break;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
    }
  }
  return found;
}
