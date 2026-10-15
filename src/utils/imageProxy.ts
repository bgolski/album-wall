import type { CoverSource } from "./coverSource";

/**
 * Utilities for routing remote album artwork through the app's own image service or a
 * third-party proxy, and falling back to a built-in placeholder when no usable image is available.
 */

/**
 * The app's own cover image service (`?url=<cover>&w=<width>`), which serves resized copies of
 * covers that pages may read. An empty value turns it off.
 */
const IMAGE_SERVICE =
  process.env.NEXT_PUBLIC_IMAGE_SERVICE_URL ?? "https://albumwall.bradleygolski.com/img";

/** Widths the image service makes; a request is rounded up to the next one. */
const SERVICE_WIDTHS = [64, 320, 600];

/** Third-party resizing proxy, used when the image service cannot serve a cover. */
const IMAGE_PROXY = "https://images.weserv.nl/?url=";

/**
 * Pixel size requested for covers shown as tiles. Tiles are at most about 170 CSS pixels wide, so
 * this stays sharp on 2x screens while downloading far less than the original artwork.
 */
export const TILE_COVER_SIZE = 320;

// Default embedded placeholder image as base64 - this ensures we never get 404s for images
export const DEFAULT_PLACEHOLDER_IMAGE =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iIzIyMiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNhYWEiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiPkFsYnVtIEFydHdvcms8L3RleHQ+PC9zdmc+";

/**
 * Converts a remote image URL into a proxied URL to improve browser loading and export behavior.
 *
 * @param url Original image URL.
 * @param options Options for proxied image generation.
 * @param options.size Desired square dimensions (width and height) for the proxied image.
 * @returns A proxied image URL or the placeholder image when no URL is provided.
 */
export function getProxiedImageUrl(url: string, options: { size?: number } = {}): string {
  // If no URL is provided, return the placeholder
  if (!url) return DEFAULT_PLACEHOLDER_IMAGE;

  // If it's already a data URL, return as is
  if (url.startsWith("data:")) {
    return url;
  }

  // Use images.weserv.nl as the default proxy which works well for most images
  const baseUrl = `${IMAGE_PROXY}${encodeURIComponent(url)}`;

  // Append size parameters when requested
  if (options.size) {
    return `${baseUrl}&w=${options.size}&h=${options.size}&fit=cover`;
  }

  return baseUrl;
}

/** Whether the image service fetches covers from this address (Discogs and Cover Art Archive). */
function isServiceHost(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return (
      protocol === "https:" &&
      (hostname === "i.discogs.com" ||
        hostname === "st.discogs.com" ||
        hostname === "coverartarchive.org" ||
        hostname === "archive.org" ||
        hostname.endsWith(".archive.org"))
    );
  } catch {
    return false;
  }
}

/**
 * Address of a cover's copy from the app's image service: square, at the smallest width it makes
 * that is at least `size` (the largest when no size is given).
 *
 * @param url Original cover address.
 * @param options.size Desired square size in pixels.
 * @returns The service address, or null when the service is off or does not serve this host.
 */
export function getServiceImageUrl(url: string, options: { size?: number } = {}): string | null {
  if (!IMAGE_SERVICE || !isServiceHost(url)) return null;
  const width =
    SERVICE_WIDTHS.find((width) => options.size != null && width >= options.size) ??
    SERVICE_WIDTHS[SERVICE_WIDTHS.length - 1];
  return `${IMAGE_SERVICE}?url=${encodeURIComponent(url)}&w=${width}`;
}

/**
 * Where to load a cover from, best first, for the sources the page is using.
 *
 * @param url Original cover address.
 * @param sources Sources to use, in order (see `coverSources`).
 * @param options.size Desired square size in pixels; the original size when omitted.
 * @returns Each address with the source it comes from.
 */
export function coverAddresses(
  url: string,
  sources: readonly CoverSource[],
  options: { size?: number } = {}
): { src: string; source: CoverSource }[] {
  if (!url) return [];
  const sized = options.size != null ? { size: options.size } : {};
  return sources.flatMap((source) => {
    const src =
      source === "service"
        ? getServiceImageUrl(url, sized)
        : source === "proxy"
          ? getProxiedImageUrl(url, sized)
          : url;
    return src ? [{ src, source }] : [];
  });
}
