import { SharedWallState } from "@/types";

const SHARE_HASH_KEY = "share";

interface BuildSharedWallStateParams {
  username: string;
  rows: number;
  columns: number;
  wallAlbumIds: string[];
  pinnedAlbumIds: string[];
}

/**
 * Builds the serializable wall state payload used for shareable hash links.
 *
 * @param params Current wall state fields to persist in the share link.
 * @returns A versioned shared wall state payload.
 */
export function buildSharedWallState({
  username,
  rows,
  columns,
  wallAlbumIds,
  pinnedAlbumIds,
}: BuildSharedWallStateParams): SharedWallState {
  return {
    v: 1,
    username,
    rows,
    columns,
    wallAlbumIds,
    pinnedAlbumIds,
  };
}

function encodeBase64Url(value: string): string {
  if (typeof window === "undefined") {
    return Buffer.from(value, "utf-8").toString("base64url");
  }

  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): string {
  if (typeof window === "undefined") {
    return Buffer.from(value, "base64url").toString("utf-8");
  }

  const paddedValue = value.replace(/-/g, "+").replace(/_/g, "/");
  const normalizedValue = paddedValue + "=".repeat((4 - (paddedValue.length % 4 || 4)) % 4);
  return atob(normalizedValue);
}

/**
 * Encodes shared wall state into a URL-safe hash payload.
 *
 * @param state Shared wall state to encode.
 * @returns URL-safe encoded share payload.
 */
export function encodeSharedWallState(state: SharedWallState): string {
  return encodeBase64Url(JSON.stringify(state));
}

/**
 * Decodes and validates a shared wall state payload from a hash string.
 *
 * @param encodedState URL-safe encoded share payload.
 * @returns Parsed shared wall state when valid, otherwise `null`.
 */
export function decodeSharedWallState(encodedState: string): SharedWallState | null {
  try {
    const parsedState = JSON.parse(decodeBase64Url(encodedState)) as Partial<SharedWallState>;

    if (
      parsedState.v !== 1 ||
      typeof parsedState.username !== "string" ||
      typeof parsedState.rows !== "number" ||
      typeof parsedState.columns !== "number" ||
      !Array.isArray(parsedState.wallAlbumIds) ||
      !Array.isArray(parsedState.pinnedAlbumIds)
    ) {
      return null;
    }

    return {
      v: 1,
      username: parsedState.username,
      rows: parsedState.rows,
      columns: parsedState.columns,
      wallAlbumIds: parsedState.wallAlbumIds.map(String),
      pinnedAlbumIds: parsedState.pinnedAlbumIds.map(String),
    };
  } catch {
    return null;
  }
}

/**
 * Builds the hash fragment for a shareable wall link.
 *
 * @param encodedState URL-safe encoded share payload.
 * @returns Hash string including the share prefix.
 */
export function buildShareHash(encodedState: string): string {
  return `#${SHARE_HASH_KEY}=${encodedState}`;
}

/**
 * Extracts an encoded shared wall payload from a location hash.
 *
 * @param hash Location hash to inspect.
 * @returns Encoded share payload when present, otherwise `null`.
 */
export function getEncodedSharedWallStateFromHash(hash: string): string | null {
  const normalizedHash = hash.startsWith("#") ? hash.slice(1) : hash;
  const searchParams = new URLSearchParams(normalizedHash);
  return searchParams.get(SHARE_HASH_KEY);
}

/**
 * Parses shared wall state from a location hash.
 *
 * @param hash Location hash to inspect.
 * @returns Parsed shared wall state when present and valid, otherwise `null`.
 */
export function getSharedWallStateFromHash(hash: string): SharedWallState | null {
  const encodedState = getEncodedSharedWallStateFromHash(hash);
  return encodedState ? decodeSharedWallState(encodedState) : null;
}

/**
 * Builds a full share URL by replacing the current location hash.
 *
 * @param state Shared wall state to encode into the URL.
 * @param currentUrl Current page URL.
 * @returns Absolute share URL containing the encoded wall state in the hash.
 */
export function buildSharedWallUrl(state: SharedWallState, currentUrl: string): string {
  const url = new URL(currentUrl);
  url.hash = buildShareHash(encodeSharedWallState(state));
  return url.toString();
}
