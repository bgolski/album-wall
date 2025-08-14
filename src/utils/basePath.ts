/**
 * Helper to get the base path for assets
 * Handles both development and production environments
 */
export function getBasePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH || "";
}
