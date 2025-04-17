import axios from "axios";
import { Album } from "../types/index";

const discogsToken = process.env.NEXT_PUBLIC_DISCOGS_TOKEN;
const baseURL = "https://api.discogs.com";

// Maximum retry attempts for API calls
const MAX_RETRIES = 2;

interface DiscogsRelease {
  id: number;
  basic_information: {
    title?: string;
    cover_image?: string;
    artists?: {
      name: string;
      join?: string;
    }[];
    genres?: string[];
  };
}

interface DiscogsImage {
  type: string;
  uri: string;
}

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

    console.log(`Request failed, retrying in ${delay}ms... (${retries} attempts left)`);
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

    // Display token status (masked for security)
    console.log("Using Discogs token:", discogsToken ? "✓ Token available" : "✗ No token found");

    if (!discogsToken) {
      console.warn(
        "No Discogs API token found in environment variables. API requests may be rate limited."
      );
    }

    // Build the request URL
    const requestUrl = `${baseURL}/users/${username}/collection/folders/0/releases`;
    console.log("Requesting collection from:", requestUrl);

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

    // Debug full response for first item
    console.log("Full first item:", JSON.stringify(response.data.releases[0], null, 2));

    return response.data.releases.map((release: DiscogsRelease) => {
      const basicInfo = release.basic_information;

      // Extract artist name - Discogs usually provides this in the artists array
      let artistName = "Unknown Artist";

      if (basicInfo.artists && Array.isArray(basicInfo.artists) && basicInfo.artists.length > 0) {
        // Use the first artist's name
        artistName = basicInfo.artists[0].name;

        // If there are multiple artists, Discogs often includes a join field (like ", " or " & ")
        if (basicInfo.artists.length > 1) {
          let artistString = basicInfo.artists[0].name;

          for (let i = 1; i < basicInfo.artists.length; i++) {
            const artist = basicInfo.artists[i];
            const join = artist.join || ", ";
            artistString += join + artist.name;
          }

          artistName = artistString;
        }
      }

      // For backwards compatibility, include both cover_image and coverUrl
      return {
        id: release.id,
        title: basicInfo.title || "",
        cover_image: basicInfo.cover_image || "",
        coverUrl: basicInfo.cover_image || "", // For backward compatibility
        artist: artistName,
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

// New function to fetch album images by release IDs
export async function fetchAlbumCovers(releaseIds: number[]): Promise<Record<number, string>> {
  const coverMap: Record<number, string> = {};

  try {
    console.log("Fetching covers for release IDs:", releaseIds);

    // Process in smaller batches to avoid rate limiting
    const batchSize = 3; // Reducing batch size to be gentler on the API

    for (let i = 0; i < releaseIds.length; i += batchSize) {
      const batch = releaseIds.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}:`, batch);

      const promises = batch.map(async (id) => {
        try {
          console.log(`Fetching data for release ID: ${id}`);

          // First try to fetch using master endpoint
          const endpoint = `${baseURL}/masters/${id}`;
          console.log(`Trying master endpoint: ${endpoint}`);

          let response;
          try {
            response = await makeRequestWithRetry(() =>
              axios.get(endpoint, {
                headers: {
                  Authorization: `Discogs token=${discogsToken}`,
                },
              })
            );
          } catch {
            console.log(`Master endpoint failed for ID ${id}, trying release endpoint`);

            // If master fails, try release endpoint
            const releaseEndpoint = `${baseURL}/releases/${id}`;
            console.log(`Trying release endpoint: ${releaseEndpoint}`);

            response = await makeRequestWithRetry(() =>
              axios.get(releaseEndpoint, {
                headers: {
                  Authorization: `Discogs token=${discogsToken}`,
                },
              })
            );
          }

          console.log(
            `Got response for ID ${id}:`,
            response.data && response.data.images
              ? `Found ${response.data.images.length} images`
              : "No images found"
          );

          if (response.data && response.data.images && response.data.images.length > 0) {
            // Find the primary image or use the first image
            const primaryImage =
              response.data.images.find((img: DiscogsImage) => img.type === "primary") ||
              response.data.images[0];
            coverMap[id] = primaryImage.uri;
            console.log(`Set cover for ID ${id} to:`, primaryImage.uri);
          } else {
            console.log(`No images found for release ID: ${id}`);
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`Error fetching release ${id}:`, errorMessage);
          // No need to try fetching from collection, as the calling code will handle fallbacks
        }
      });

      // Wait for batch to complete
      await Promise.all(promises);

      // Wait a bit between batches to avoid rate limiting
      if (i + batchSize < releaseIds.length) {
        console.log("Waiting between batches to avoid rate limiting...");
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Increased delay
      }
    }

    console.log("Finished fetching covers, found:", Object.keys(coverMap).length);
    return coverMap;
  } catch (error) {
    console.error("Error fetching album covers:", error);
    return coverMap;
  }
}
