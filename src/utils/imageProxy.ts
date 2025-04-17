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

/**
 * Converts an image URL to use a CORS-friendly proxy
 * @param url Original image URL
 * @param proxyIndex Index of proxy service to use (defaults to first one)
 * @returns Proxied URL
 */
export function getProxiedImageUrl(url: string, proxyIndex = 0): string {
  if (!url) return "";

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

/**
 * Try multiple proxy services if the first one fails
 * @param originalUrl The original image URL
 * @param onSuccess Callback when an image successfully loads
 */
export function tryMultipleProxies(originalUrl: string, onSuccess: (url: string) => void): void {
  // Try each proxy service in sequence
  let currentIndex = 0;

  function tryNextProxy() {
    if (currentIndex >= PROXY_SERVICES.length) {
      console.error("All proxy services failed for image:", originalUrl);
      return;
    }

    const proxiedUrl = getProxiedImageUrl(originalUrl, currentIndex);

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = function () {
      onSuccess(proxiedUrl);
    };

    img.onerror = function () {
      console.warn(`Proxy service ${currentIndex} failed for ${originalUrl}, trying next one`);
      currentIndex++;
      tryNextProxy();
    };

    img.src = proxiedUrl;
  }

  tryNextProxy();
}
