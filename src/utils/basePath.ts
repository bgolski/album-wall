/**
 * Helper to get the base path for assets
 * Handles both development and production environments
 */
export function getBasePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH || "";
}

/**
 * Create absolute URL with proper base path
 */
export function createUrl(path: string): string {
  const basePath = getBasePath();
  return `${basePath}${path}`;
}
