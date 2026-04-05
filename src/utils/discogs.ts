import { Album } from "../types/index";

const discogsProxyUrl = process.env.NEXT_PUBLIC_DISCOGS_PROXY_URL;

type DiscogsProxyResponse = {
  username?: string;
  albums?: Album[];
  error?: string;
};

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
 * @returns Albums sorted by Discogs artist order for the user's collection.
 * @throws Error when the username is invalid, proxy config is missing, or the proxy returns a failure.
 */
export async function getUserCollection(username: string): Promise<Album[]> {
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

  let response: Response;

  try {
    response = await fetch(requestUrl.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });
  } catch {
    throw new Error("No response from the Discogs proxy. Please check your network connection.");
  }

  let responseBody: DiscogsProxyResponse | null = null;

  try {
    responseBody = (await response.json()) as DiscogsProxyResponse;
  } catch {
    responseBody = null;
  }

  if (!response.ok) {
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

  if (!Array.isArray(responseBody?.albums) || responseBody.albums.length === 0) {
    throw new Error(`User "${username}" has no vinyl records in their collection`);
  }

  return responseBody.albums;
}

export { GENERIC_PROXY_ERROR_MESSAGE };
