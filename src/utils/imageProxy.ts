/**
 * Utility to proxy image URLs through a CORS-friendly service
 * This helps with loading images from external sources that might have CORS restrictions
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
 * Converts an image URL to use a CORS-friendly proxy
 * @param url Original image URL
 * @param proxyIndex Index of proxy service to use (defaults to first one)
 * @returns Proxied URL
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
