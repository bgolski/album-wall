import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

const BASE_URL = "https://api.discogs.com";
const COLLECTION_PAGE_SIZE = 100;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
// Measured on a 75-album collection: about 0.7 s per warm page of 100 and 573 bytes per album in
// the response, so the 6 MB response limit allows roughly 10,000 albums. The limits below stay
// well inside that and inside the function's 30 s timeout.
const REQUEST_TIMEOUT_MS = 5000;
const TIME_BUDGET_MS = 25000;
const PAGE_CONCURRENCY = 4;
const MAX_COLLECTION_ITEMS = 8000;

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

type DiscogsError = Error & { statusCode?: number; retryAfterMs?: number; timedOut?: boolean };

/**
 * Creates an error carrying the HTTP status that the response mapper turns into a reply.
 *
 * @param message Human-readable message.
 * @param statusCode HTTP status to associate with the failure.
 * @param retryAfterMs How long Discogs asked the client to wait, when it said.
 * @returns The error.
 */
function httpError(message: string, statusCode: number, retryAfterMs?: number): DiscogsError {
  const error: DiscogsError = new Error(message);
  error.statusCode = statusCode;
  if (retryAfterMs !== undefined) error.retryAfterMs = retryAfterMs;
  return error;
}

/**
 * Reads a Retry-After header given in seconds.
 *
 * @param value Header value, if any.
 * @returns The wait in milliseconds, or undefined when it is absent or not a number of seconds.
 */
function parseRetryAfterMs(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined;
}

/**
 * Runs a Discogs request, retrying only what can succeed on a second try: network errors and 5xx
 * responses with exponential backoff, and a 429 once when Discogs asks for a wait that fits in
 * the time left. Other 4xx responses and timeouts are never retried.
 *
 * @param request Async request callback to execute.
 * @param deadline Time (ms since the epoch) after which no more waiting is allowed.
 * @param retries Remaining retry attempts.
 * @param delay Delay in milliseconds before the next retry.
 * @returns The resolved request result.
 */
async function makeRequestWithRetry<T>(
  request: () => Promise<T>,
  deadline: number,
  retries = MAX_RETRIES,
  delay = RETRY_DELAY_MS
): Promise<T> {
  if (Date.now() >= deadline) {
    throw httpError("Loading the collection took too long.", 504);
  }

  try {
    return await request();
  } catch (error) {
    const statusCode =
      error instanceof Error && "statusCode" in error
        ? Number((error as DiscogsError).statusCode)
        : undefined;

    if (statusCode === 429) {
      const wait = (error as DiscogsError).retryAfterMs;
      const timeLeft = deadline - Date.now();
      if (wait === undefined || retries <= 0 || wait + REQUEST_TIMEOUT_MS > timeLeft) throw error;
      await new Promise((resolve) => setTimeout(resolve, wait));
      return makeRequestWithRetry(request, deadline, 0, delay);
    }

    const retryable =
      !(error as DiscogsError).timedOut && (statusCode === undefined || statusCode >= 500);
    if (!retryable || retries <= 0) throw error;

    await new Promise((resolve) => setTimeout(resolve, delay));
    return makeRequestWithRetry(request, deadline, retries - 1, delay * 2);
  }
}

/**
 * Fetches a single page from the Discogs collection endpoint.
 *
 * @param username Discogs username whose collection should be loaded.
 * @param token Discogs personal token used for authenticated requests.
 * @param page Collection page number to fetch.
 * @param deadline Time (ms since the epoch) after which no more waiting is allowed.
 * @returns One page of the Discogs collection response.
 */
async function fetchCollectionPage(
  username: string,
  token: string,
  page: number,
  deadline: number
): Promise<DiscogsCollectionResponse> {
  const requestUrl = new URL(`${BASE_URL}/users/${username}/collection/folders/0/releases`);

  requestUrl.searchParams.set("per_page", String(COLLECTION_PAGE_SIZE));
  requestUrl.searchParams.set("sort", "artist");
  requestUrl.searchParams.set("page", String(page));

  return makeRequestWithRetry(async () => {
    let response: Response;

    try {
      response = await fetch(requestUrl, {
        headers: {
          Authorization: `Discogs token=${token}`,
          "User-Agent": "album-wall-discogs-proxy/1.0",
        },
        signal: AbortSignal.timeout(
          Math.min(REQUEST_TIMEOUT_MS, Math.max(deadline - Date.now(), 1))
        ),
      });
    } catch (error) {
      const errorName = (error as { name?: string } | null)?.name;
      if (errorName === "TimeoutError" || errorName === "AbortError") {
        throw Object.assign(httpError("Discogs took too long to respond.", 504), {
          timedOut: true,
        });
      }
      throw error;
    }

    if (!response.ok) {
      throw httpError(
        `Discogs request failed with status ${response.status}`,
        response.status,
        parseRetryAfterMs(response.headers.get("Retry-After"))
      );
    }

    return (await response.json()) as DiscogsCollectionResponse;
  }, deadline);
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

  const deadline = Date.now() + TIME_BUDGET_MS;
  const token = await getSecureParameter(tokenParameterName);
  const firstPage = await fetchCollectionPage(username, token, 1, deadline);
  const allReleases = [...(firstPage.releases || [])];
  const totalPages = Math.max(firstPage.pagination?.pages || 1, 1);
  const totalItems = firstPage.pagination?.items ?? allReleases.length;

  if (totalItems > MAX_COLLECTION_ITEMS) {
    throw httpError(
      `This collection has ${totalItems} records; the limit is ${MAX_COLLECTION_ITEMS}.`,
      413
    );
  }

  // Later pages load a few at a time, in page order, to stay inside Discogs's rate limit.
  for (let first = 2; first <= totalPages; first += PAGE_CONCURRENCY) {
    const pages = Array.from(
      { length: Math.min(PAGE_CONCURRENCY, totalPages - first + 1) },
      (_, offset) => first + offset
    );
    const responses = await Promise.all(
      pages.map((page) => fetchCollectionPage(username, token, page, deadline))
    );
    for (const pageResponse of responses) allReleases.push(...(pageResponse.releases || []));
  }

  if (!allReleases.length) {
    return [];
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

  if (statusCode === 413) {
    return jsonResponse(413, {
      error: error instanceof Error ? error.message : "This collection is too large to load.",
    });
  }

  if (statusCode === 504) {
    return jsonResponse(504, {
      error: "Discogs took too long to respond. Please try again.",
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
