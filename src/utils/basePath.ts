/**
 * Returns the configured base path used for asset and route generation in static deployments.
 *
 * @returns The public base path or an empty string when no base path is configured.
 */
export function getBasePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH || "";
}
