import axios from "axios";
import { Album, DiscogsRelease } from "../types/index";

const discogsToken = process.env.NEXT_PUBLIC_DISCOGS_TOKEN;
const baseURL = "https://api.discogs.com";

// Maximum retry attempts for API calls
const MAX_RETRIES = 2;

/**
 * Makes an API request with retry logic
 */
async function makeRequestWithRetry<T>(
  requestFunction: () => Promise<T>,
  retries = MAX_RETRIES,
  delay = 1000
): Promise<T> {
  try {
    return await requestFunction();
  } catch (error) {
    if (retries <= 0) throw error;

    // Check if it's not a 404 (no point retrying not found errors)
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      throw error;
    }

    // Wait before retrying
    await new Promise((resolve) => setTimeout(resolve, delay));
    return makeRequestWithRetry(requestFunction, retries - 1, delay * 2);
  }
}

/**
 * Validates a Discogs username format
 */
export function validateDiscogsUsername(username: string): boolean {
  // Discogs usernames should be alphanumeric + some special chars
  // This is a basic validation - Discogs specific rules might vary
  return /^[a-zA-Z0-9._-]{2,}$/.test(username.trim());
}

/**
 * Extracts artist name from Discogs release data
 */
function extractArtistName(artists?: { name: string; join?: string }[]): string {
  if (!artists || !Array.isArray(artists) || artists.length === 0) {
    return "Unknown Artist";
  }

  if (artists.length === 1) {
    return artists[0].name;
  }

  // Handle multiple artists with join strings
  return artists.reduce((artistString, artist, index) => {
    if (index === 0) return artist.name;
    const join = artist.join || ", ";
    return artistString + join + artist.name;
  }, "");
}

export async function getUserCollection(username: string): Promise<Album[]> {
  try {
    if (!username.trim()) {
      throw new Error("Username cannot be empty");
    }

    // Basic format validation
    if (!validateDiscogsUsername(username)) {
      throw new Error(
        "Invalid username format. Usernames should contain only letters, numbers, dots, underscores, or hyphens."
      );
    }

    if (!discogsToken) {
      console.warn(
        "No Discogs API token found in environment variables. API requests may be rate limited."
      );
    }

    // Build the request URL
    const requestUrl = `${baseURL}/users/${username}/collection/folders/0/releases`;

    // Use retry logic for the API call
    const response = await makeRequestWithRetry(() =>
      axios.get(requestUrl, {
        headers: {
          Authorization: discogsToken ? `Discogs token=${discogsToken}` : "",
        },
        params: {
          per_page: 100,
          sort: "artist",
        },
      })
    );

    // If the API returned no releases, throw a custom error
    if (
      !response.data.releases ||
      !Array.isArray(response.data.releases) ||
      response.data.releases.length === 0
    ) {
      throw new Error(`User "${username}" has no vinyl records in their collection`);
    }

    return response.data.releases.map((release: DiscogsRelease) => {
      const basicInfo = release.basic_information;
      const coverImage = basicInfo.cover_image || "";

      return {
        id: release.id,
        title: basicInfo.title || "",
        cover_image: coverImage,
        coverUrl: coverImage, // For backward compatibility
        artist: extractArtistName(basicInfo.artists),
        genre: basicInfo.genres || [],
        year: "",
      };
    });
  } catch (error: unknown) {
    console.error("Error fetching collection:", error);

    // Check for specific error types and rethrow with more context
    if (axios.isAxiosError(error)) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        if (error.response.status === 404) {
          throw new Error(`User "${username}" not found on Discogs`);
        } else if (error.response.status === 429) {
          throw new Error("Rate limit exceeded. Please try again in a few minutes.");
        } else if (error.response.status === 401) {
          throw new Error("Authentication failed. Please check your Discogs API token.");
        } else if (error.response.status >= 500) {
          throw new Error(
            "Discogs server error. The service may be experiencing issues. Please try again later."
          );
        } else {
          throw new Error(
            `Discogs API error: ${error.response.status} - ${error.response.statusText || "Unknown error"}`
          );
        }
      } else if (error.request) {
        // The request was made but no response was received
        throw new Error("No response from Discogs API. Please check your network connection.");
      }
    } else if (error instanceof Error) {
      // Pass through custom errors we've already thrown
      throw error;
    }

    // For any other errors, provide a generic message
    throw new Error(
      "An unexpected error occurred while connecting to Discogs. Please try again later."
    );
  }
}
