/**
 * Utilities for routing remote album artwork through a proxy service and falling back to a
 * built-in placeholder when no usable image is available.
 */

// List of image proxy services we can use
const PROXY_SERVICES = [
  "https://images.weserv.nl/?url=",
  "https://cors-anywhere.herokuapp.com/",
  "https://api.allorigins.win/raw?url=",
];

// Default embedded placeholder image as base64 - this ensures we never get 404s for images
export const DEFAULT_PLACEHOLDER_IMAGE =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iIzIyMiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNhYWEiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiPkFsYnVtIEFydHdvcms8L3RleHQ+PC9zdmc+";

/**
 * Converts a remote image URL into a proxied URL to improve browser loading and export behavior.
 *
 * @param url Original image URL.
 * @param proxyIndex Preferred proxy service index.
 * @returns A proxied image URL or the placeholder image when no URL is provided.
 */
export function getProxiedImageUrl(url: string, proxyIndex = 0): string {
  // If no URL is provided, return the placeholder
  if (!url) return DEFAULT_PLACEHOLDER_IMAGE;

  // If it's already a data URL, return as is
  if (url.startsWith("data:")) {
    return url;
  }

  // Make sure we're using a valid proxy index
  const serviceIndex = Math.min(proxyIndex, PROXY_SERVICES.length - 1);
  const proxyService = PROXY_SERVICES[serviceIndex];

  // Use images.weserv.nl as the default proxy which works well for most images
  if (serviceIndex === 0) {
    // For weserv.nl, we need to encode the URL
    return `${proxyService}${encodeURIComponent(url)}`;
  }

  // For other proxies, we can just append the URL
  return `${proxyService}${url}`;
}
