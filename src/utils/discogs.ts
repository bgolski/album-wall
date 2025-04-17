import axios from "axios";
import { Album } from "@/types";

const discogsToken = process.env.NEXT_PUBLIC_DISCOGS_TOKEN;
const baseURL = "https://api.discogs.com";

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

export async function getUserCollection(username: string): Promise<Album[]> {
  try {
    const response = await axios.get(
      `${baseURL}/users/${username}/collection/folders/0/releases`,
      {
        headers: {
          Authorization: `Discogs token=${discogsToken}`,
        },
        params: {
          per_page: 100,
          sort: "artist",
        },
      }
    );

    // Debug full response for first item
    console.log(
      "Full first item:",
      JSON.stringify(response.data.releases[0], null, 2)
    );

    return response.data.releases.map((release: DiscogsRelease) => {
      const basicInfo = release.basic_information;

      // Extract artist name - Discogs usually provides this in the artists array
      let artistName = "Unknown Artist";

      if (
        basicInfo.artists &&
        Array.isArray(basicInfo.artists) &&
        basicInfo.artists.length > 0
      ) {
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

      return {
        id: release.id,
        title: basicInfo.title || "",
        cover_image: basicInfo.cover_image || "",
        artist: artistName,
        genre: basicInfo.genres || [],
      };
    });
  } catch (error) {
    console.error("Error fetching collection:", error);
    return [];
  }
}

// New function to fetch album images by release IDs
export async function fetchAlbumCovers(
  releaseIds: number[]
): Promise<Record<number, string>> {
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
            response = await axios.get(endpoint, {
              headers: {
                Authorization: `Discogs token=${discogsToken}`,
              },
            });
          } catch {
            console.log(
              `Master endpoint failed for ID ${id}, trying release endpoint`
            );

            // If master fails, try release endpoint
            const releaseEndpoint = `${baseURL}/releases/${id}`;
            console.log(`Trying release endpoint: ${releaseEndpoint}`);

            response = await axios.get(releaseEndpoint, {
              headers: {
                Authorization: `Discogs token=${discogsToken}`,
              },
            });
          }

          console.log(
            `Got response for ID ${id}:`,
            response.data && response.data.images
              ? `Found ${response.data.images.length} images`
              : "No images found"
          );

          if (
            response.data &&
            response.data.images &&
            response.data.images.length > 0
          ) {
            // Find the primary image or use the first image
            const primaryImage =
              response.data.images.find(
                (img: DiscogsImage) => img.type === "primary"
              ) || response.data.images[0];
            coverMap[id] = primaryImage.uri;
            console.log(`Set cover for ID ${id} to:`, primaryImage.uri);
          } else {
            console.log(`No images found for release ID: ${id}`);
          }
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error(`Error fetching release ${id}:`, errorMessage);
          // Try getting from collection if available
          try {
            const collection = await getUserCollection("bgolski"); // Use your username
            const matchingAlbum = collection.find((album) => album.id === id);
            if (matchingAlbum && matchingAlbum.cover_image) {
              coverMap[id] = matchingAlbum.cover_image;
              console.log(
                `Found cover for ID ${id} in collection:`,
                matchingAlbum.cover_image
              );
            }
          } catch (collectionError) {
            console.error(
              "Failed to get from collection too:",
              collectionError
            );
          }
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

    console.log(
      "Finished fetching covers, found:",
      Object.keys(coverMap).length
    );
    return coverMap;
  } catch (error) {
    console.error("Error fetching album covers:", error);
    return coverMap;
  }
}
