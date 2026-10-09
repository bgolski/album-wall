import { giveCopiesUniqueIds } from "./uniqueAlbumIds";
import { Album } from "../types/index";

const discogsProxyUrl = process.env.NEXT_PUBLIC_DISCOGS_PROXY_URL;

type DiscogsProxyResponse = {
  username?: string;
  albums?: Album[];
  error?: string;
};

// The proxy reports a user with no records as an error; the app treats it as an empty collection.
const EMPTY_COLLECTION_PATTERN = /has no vinyl records/i;

// Long enough for a large collection to be paged through, short enough that a stalled request
// ends in an error with a retry button instead of a spinner that never stops.
const PROXY_TIMEOUT_MS = 60_000;

const TIMEOUT_MESSAGE = "The Discogs proxy took too long to respond. Please try again.";

const GENERIC_PROXY_ERROR_MESSAGE =
  "An unexpected error occurred while loading the Discogs collection.";

/**
 * Validates the basic character rules for a Discogs username before making API calls.
 *
 * @param username Discogs username to validate.
 * @returns True when the username matches the expected format.
 */
export function validateDiscogsUsername(username: string): boolean {
  return /^[a-zA-Z0-9._-]{2,}$/.test(username.trim());
}

/**
 * Fetches a user's Discogs collection through the AWS proxy and returns the normalized album list.
 *
 * @param username Discogs username whose collection should be loaded.
 * @param signal Optional AbortSignal to cancel the fetch.
 * @returns Albums sorted by Discogs artist order for the user's collection.
 * @throws Error when the username is invalid, proxy config is missing, or the proxy returns a failure.
 */
export async function getUserCollection(username: string, signal?: AbortSignal): Promise<Album[]> {
  if (!username.trim()) {
    throw new Error("Username cannot be empty");
  }

  if (!validateDiscogsUsername(username)) {
    throw new Error(
      "Invalid username format. Usernames should contain only letters, numbers, dots, underscores, or hyphens."
    );
  }

  if (!discogsProxyUrl) {
    throw new Error("Discogs proxy URL is not configured.");
  }

  const requestUrl = new URL(discogsProxyUrl);
  requestUrl.searchParams.set("username", username);

  // One timer covers both the request and reading its body; a caller's own signal still wins.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, PROXY_TIMEOUT_MS);
  const abortWithCaller = () => controller.abort();
  signal?.addEventListener("abort", abortWithCaller, { once: true });

  try {
    let response: Response;

    try {
      response = await fetch(requestUrl.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      if (timedOut) throw new Error(TIMEOUT_MESSAGE);
      throw new Error("No response from the Discogs proxy. Please check your network connection.");
    }

    let responseBody: DiscogsProxyResponse | null = null;

    try {
      responseBody = (await response.json()) as DiscogsProxyResponse;
    } catch {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      if (timedOut) throw new Error(TIMEOUT_MESSAGE);
      responseBody = null;
    }

    if (!response.ok) {
      if (responseBody?.error && EMPTY_COLLECTION_PATTERN.test(responseBody.error)) {
        return [];
      }

      if (responseBody?.error) {
        throw new Error(responseBody.error);
      }

      if (response.status === 404) {
        throw new Error(`User "${username}" not found on Discogs`);
      }

      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please try again in a few minutes.");
      }

      if (response.status >= 500) {
        throw new Error("Discogs proxy error. Please try again later.");
      }

      throw new Error(
        `Discogs proxy error: ${response.status} - ${response.statusText || "Unknown error"}`
      );
    }

    if (!Array.isArray(responseBody?.albums)) {
      throw new Error(GENERIC_PROXY_ERROR_MESSAGE);
    }

    // Someone who owns two copies of a release gets the same id twice; tiles need distinct ones.
    return giveCopiesUniqueIds(responseBody.albums);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abortWithCaller);
  }
}

export { GENERIC_PROXY_ERROR_MESSAGE };
