/**
 * Utilities for routing remote album artwork through a proxy service and falling back to a
 * built-in placeholder when no usable image is available.
 */

const IMAGE_PROXY = "https://images.weserv.nl/?url=";

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
