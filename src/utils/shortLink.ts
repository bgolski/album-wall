// Long enough for the proxy to store the wall, short enough that sharing never waits long.
const SHORT_LINK_TIMEOUT_MS = 3000;
const SHORT_LINK = /^https:\/\/[a-z0-9.-]+\/w\/[A-Za-z0-9]{8}$/;

/** What the proxy needs to store a wall behind a short link. */
export interface ShortLinkRequest {
  /** The wall as written in a long share link (after `#share=`). */
  payload: string;
  /** The app address the short link opens. */
  app: string;
  /** Title shown in message previews. */
  title: string;
  rows: number;
  columns: number;
  /** Cover image addresses in wall order, for the preview picture. */
  covers: string[];
}

/**
 * Asks the proxy for a short link that shows the wall in message previews.
 *
 * @param request The wall to store.
 * @param proxyUrl The Discogs proxy address.
 * @returns The short link, or `null` when there is no proxy, it fails or it is slow.
 */
export async function requestShortLink(
  request: ShortLinkRequest,
  proxyUrl = process.env.NEXT_PUBLIC_DISCOGS_PROXY_URL
): Promise<string | null> {
  if (!proxyUrl) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SHORT_LINK_TIMEOUT_MS);
  try {
    const response = await fetch(new URL("share", proxyUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const { url } = (await response.json()) as { url?: unknown };
    return typeof url === "string" && SHORT_LINK.test(url) ? url : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
