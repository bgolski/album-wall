import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

const BASE_URL = "https://api.discogs.com";
const COLLECTION_PAGE_SIZE = 100;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

type DiscogsArtist = {
  name: string;
  join?: string;
};

type DiscogsRelease = {
  id: number;
  basic_information: {
    id?: number;
    title?: string;
    cover_image?: string;
    artists?: DiscogsArtist[];
    genres?: string[];
  };
};

type DiscogsCollectionResponse = {
  pagination?: {
    page?: number;
    pages?: number;
    per_page?: number;
    items?: number;
  };
  releases?: DiscogsRelease[];
};

type Album = {
  id: number;
  title: string;
  cover_image?: string;
  coverUrl?: string;
  discogsUrl?: string | undefined;
  artist: string;
  genre?: string[];
  year?: string;
};

type LambdaEvent = {
  queryStringParameters?: Record<string, string | undefined> | null;
  requestContext?: {
    http?: {
      method?: string;
    };
  };
};

const ssmClient = new SSMClient({});
const cachedParameters = new Map<string, string>();

/**
 * Builds a JSON Lambda response with the default content type header.
 *
 * @param statusCode HTTP status code to return.
 * @param body JSON-serializable response body.
 * @returns Lambda Function URL response payload.
 */
function jsonResponse(statusCode: number, body: Record<string, unknown>) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

/**
 * Reads a secure parameter from SSM and caches it in-memory for warm Lambda invocations.
 *
 * @param parameterName SecureString parameter path to read.
 * @returns Decrypted parameter value.
 */
async function getSecureParameter(parameterName: string): Promise<string> {
  const cachedValue = cachedParameters.get(parameterName);

  if (cachedValue) {
    return cachedValue;
  }

  const response = await ssmClient.send(
    new GetParameterCommand({
      Name: parameterName,
      WithDecryption: true,
    })
  );

  const value = response.Parameter?.Value?.trim();

  if (!value) {
    throw new Error(`Missing secure parameter: ${parameterName}`);
  }

  cachedParameters.set(parameterName, value);
  return value;
}

/**
 * Validates the basic character rules for a Discogs username before making API calls.
 *
 * @param username Discogs username to validate.
 * @returns True when the username matches the expected format.
 */
function validateDiscogsUsername(username: string): boolean {
  return /^[a-zA-Z0-9._-]{2,}$/.test(username.trim());
}

/**
 * Removes the number Discogs appends to tell apart artists who share a name,
 * for example "Travis Scott (2)" becomes "Travis Scott".
 *
 * @param name Artist name as returned by Discogs.
 * @returns The name without a trailing " (n)".
 */
export function cleanArtistName(name: string): string {
  return name.replace(/\s+\(\d+\)$/, "");
}

/**
 * Builds a display-friendly artist string from Discogs artist metadata.
 *
 * @param artistEntries Discogs artist entries, including optional join strings.
 * @returns A normalized artist label or `"Unknown Artist"` when none is available.
 */
function extractArtistName(artistEntries?: DiscogsArtist[]): string {
  if (!artistEntries || artistEntries.length === 0) {
    return "Unknown Artist";
  }

  const artists = artistEntries.map((artist) => ({
    ...artist,
    name: cleanArtistName(artist.name),
  }));

  // Discogs puts each separator on the artist before it ("Tony Bennett" join "&", "Amy
  // Winehouse" join ""), without surrounding spaces; a missing join or "," means a comma.
  return artists
    .map((artist, index) => {
      if (index === artists.length - 1) {
        return artist.name;
      }

      const join = artist.join?.trim();
      return `${artist.name}${!join || join === "," ? ", " : ` ${join} `}`;
    })
    .join("");
}

/**
 * Converts Discogs release metadata into a public Discogs release page URL.
 *
 * @param release Collection release payload from Discogs.
 * @returns A public Discogs URL when a release id can be resolved.
 */
function getDiscogsReleaseUrl(release: DiscogsRelease): string | undefined {
  const releaseId = release.basic_information.id ?? release.id;

  if (!releaseId) {
    return undefined;
  }

  return `https://www.discogs.com/release/${releaseId}`;
}

/**
 * Retries a request with exponential backoff while skipping retries for 404 responses.
 *
 * @param request Async request callback to execute.
 * @param retries Remaining retry attempts.
 * @param delay Delay in milliseconds before the next retry.
 * @returns The resolved request result.
 */
async function makeRequestWithRetry<T>(
  request: () => Promise<T>,
  retries = MAX_RETRIES,
  delay = RETRY_DELAY_MS
): Promise<T> {
  try {
    return await request();
  } catch (error) {
    const statusCode =
      error instanceof Error && "statusCode" in error
        ? Number((error as Error & { statusCode?: number }).statusCode)
        : undefined;

    if (retries <= 0 || statusCode === 404) {
      throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, delay));
    return makeRequestWithRetry(request, retries - 1, delay * 2);
  }
}

/**
 * Fetches a single page from the Discogs collection endpoint.
 *
 * @param username Discogs username whose collection should be loaded.
 * @param token Discogs personal token used for authenticated requests.
 * @param page Collection page number to fetch.
 * @returns One page of the Discogs collection response.
 */
async function fetchCollectionPage(
  username: string,
  token: string,
  page: number
): Promise<DiscogsCollectionResponse> {
  const requestUrl = new URL(`${BASE_URL}/users/${username}/collection/folders/0/releases`);

  requestUrl.searchParams.set("per_page", String(COLLECTION_PAGE_SIZE));
  requestUrl.searchParams.set("sort", "artist");
  requestUrl.searchParams.set("page", String(page));

  return makeRequestWithRetry(async () => {
    const response = await fetch(requestUrl, {
      headers: {
        Authorization: `Discogs token=${token}`,
        "User-Agent": "album-wall-discogs-proxy/1.0",
      },
    });

    if (!response.ok) {
      const error = new Error(`Discogs request failed with status ${response.status}`) as Error & {
        statusCode?: number;
      };
      error.statusCode = response.status;
      throw error;
    }

    return (await response.json()) as DiscogsCollectionResponse;
  });
}

/**
 * Fetches and normalizes a user's Discogs collection into the frontend album shape.
 *
 * @param username Discogs username whose collection should be loaded.
 * @returns Normalized album array sorted by Discogs artist order.
 */
async function getUserCollection(username: string): Promise<Album[]> {
  if (!username.trim()) {
    throw new Error("Username cannot be empty");
  }

  if (!validateDiscogsUsername(username)) {
    throw new Error(
      "Invalid username format. Usernames should contain only letters, numbers, dots, underscores, or hyphens."
    );
  }

  const tokenParameterName = process.env.DISCOGS_TOKEN_PARAMETER_NAME;

  if (!tokenParameterName) {
    throw new Error("Lambda is missing DISCOGS_TOKEN_PARAMETER_NAME.");
  }

  const token = await getSecureParameter(tokenParameterName);
  const firstPage = await fetchCollectionPage(username, token, 1);
  const allReleases = [...(firstPage.releases || [])];
  const totalPages = Math.max(firstPage.pagination?.pages || 1, 1);

  for (let page = 2; page <= totalPages; page += 1) {
    const pageResponse = await fetchCollectionPage(username, token, page);
    allReleases.push(...(pageResponse.releases || []));
  }

  if (!allReleases.length) {
    throw new Error(`User "${username}" has no vinyl records in their collection`);
  }

  return allReleases.map((release) => {
    const basicInfo = release.basic_information;
    const coverImage = basicInfo.cover_image || "";

    return {
      id: release.id,
      title: basicInfo.title || "",
      cover_image: coverImage,
      coverUrl: coverImage,
      discogsUrl: getDiscogsReleaseUrl(release),
      artist: extractArtistName(basicInfo.artists),
      genre: basicInfo.genres || [],
      year: "",
    };
  });
}

/**
 * Converts runtime failures into client-facing HTTP responses.
 *
 * @param error Failure thrown while fetching or normalizing the collection.
 * @param username Username associated with the request.
 * @returns Consistent JSON error response for the frontend.
 */
function mapErrorToResponse(error: unknown, username: string) {
  const statusCode =
    error instanceof Error && "statusCode" in error
      ? Number((error as Error & { statusCode?: number }).statusCode)
      : undefined;

  if (statusCode === 404) {
    return jsonResponse(404, {
      error: `User "${username}" not found on Discogs`,
    });
  }

  if (statusCode === 429) {
    return jsonResponse(429, {
      error: "Rate limit exceeded. Please try again in a few minutes.",
    });
  }

  if (statusCode === 401) {
    return jsonResponse(502, {
      error: "Authentication failed while contacting Discogs.",
    });
  }

  if (statusCode && statusCode >= 500) {
    return jsonResponse(502, {
      error: "Discogs server error. Please try again later.",
    });
  }

  if (error instanceof Error) {
    return jsonResponse(400, {
      error: error.message,
    });
  }

  return jsonResponse(500, {
    error: "An unexpected error occurred while loading the Discogs collection.",
  });
}

/**
 * Lambda Function URL handler for the Discogs collection proxy.
 *
 * @param event Function URL request event with query parameters.
 * @returns Normalized album payload or a descriptive error response.
 */
export async function handler(event: LambdaEvent) {
  const method = event.requestContext?.http?.method ?? "GET";

  if (method !== "GET") {
    return jsonResponse(405, {
      error: "Method not allowed.",
    });
  }

  const username = event.queryStringParameters?.username?.trim() || "";

  if (!username) {
    return jsonResponse(400, {
      error: 'Missing required "username" query parameter.',
    });
  }

  try {
    const albums = await getUserCollection(username);

    return jsonResponse(200, {
      username,
      albums,
    });
  } catch (error) {
    console.error("Error loading Discogs collection:", error);
    return mapErrorToResponse(error, username);
  }
}
