// Reading a Discogs collection: requests with retries inside the function's time limit, and
// the albums in the shape the app uses.

import { DISCOGS_API } from "./oauth";

const BASE_URL = DISCOGS_API;
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
    /** The master release that groups every pressing of one album; 0 or missing when none. */
    master_id?: number;
    title?: string;
    cover_image?: string;
    artists?: DiscogsArtist[];
    genres?: string[];
    styles?: string[];
    year?: number;
    labels?: { name: string }[];
    formats?: DiscogsFormat[];
  };
  date_added?: string;
};

type DiscogsFormat = {
  name?: string;
  text?: string;
  descriptions?: string[];
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

export type Album = {
  id: number;
  title: string;
  cover_image?: string;
  discogsUrl?: string | undefined;
  artist: string;
  genre?: string[];
  styles?: string[];
  year?: string;
  label?: string;
  format?: string[];
  dateAdded?: string;
  /** Discogs master release shared by every pressing of the album, when there is one. */
  masterId?: number;
};

/**
 * Validates the basic character rules for a Discogs username before making API calls.
 *
 * @returns True when the username matches the expected format.
 */
export function validateDiscogsUsername(username: string): boolean {
  return /^[a-zA-Z0-9._-]{2,}$/.test(username.trim());
}

/**
 * Removes the number Discogs appends to tell apart artists who share a name,
 * for example "Travis Scott (2)" becomes "Travis Scott".
 *
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
 * Lists a release's format details, such as "LP", "Album", "Reissue" or a vinyl color, once each
 * in Discogs order. The format name itself ("Vinyl") says nothing on a record wall.
 *
 * @returns Descriptions and free text of every format, without repeats.
 */
function extractFormatDetails(formats?: DiscogsFormat[]): string[] {
  const details = (formats ?? []).flatMap((format) => [
    ...(format.descriptions ?? []),
    ...(format.text ? [format.text] : []),
  ]);
  return [...new Set(details.map((detail) => detail.trim()).filter(Boolean))];
}

/**
 * Normalizes the time a record was added to the collection to an ISO timestamp in UTC.
 *
 * @param dateAdded Discogs `date_added`, such as "2017-03-14T10:45:25-07:00".
 * @returns The ISO timestamp, or an empty string when it is missing or unreadable.
 */
function normalizeDateAdded(dateAdded?: string): string {
  const time = dateAdded ? Date.parse(dateAdded) : NaN;
  return Number.isNaN(time) ? "" : new Date(time).toISOString();
}

type DiscogsError = Error & {
  statusCode?: number;
  retryAfterMs?: number;
  timedOut?: boolean;
};

/**
 * The HTTP status an error carries, when it carries one.
 *
 * @param error Any thrown value.
 * @returns The status, or undefined for errors from elsewhere (the network, the runtime).
 */
export function statusOf(error: unknown): number | undefined {
  return error instanceof Error && "statusCode" in error
    ? Number((error as DiscogsError).statusCode)
    : undefined;
}

/**
 * Creates an error carrying the HTTP status that the response mapper turns into a reply.
 *
 * @param retryAfterMs How long Discogs asked the client to wait, when it said.
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
 * @param deadline Time (ms since the epoch) after which no more waiting is allowed.
 * @param retries Remaining retry attempts.
 * @param delay Delay in milliseconds before the next retry.
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
    const statusCode = statusOf(error);

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
 * Sends one GET request to Discogs.
 *
 * @param failure The error message for a response that is not OK, given its status.
 * @throws A 504 error marked `timedOut` when Discogs does not answer in time, and an error carrying
 *   the status (and Retry-After wait) for a response that is not OK. Network errors pass through.
 */
async function fetchDiscogs(
  url: URL | string,
  headers: Record<string, string>,
  timeoutMs: number,
  failure: (status: number) => string
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
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
      failure(response.status),
      response.status,
      parseRetryAfterMs(response.headers.get("Retry-After"))
    );
  }
  return response;
}

/**
 * Fetches a single page from the Discogs collection endpoint.
 *
 * @param headers Builds the request headers (a signed-in request needs a new nonce each time).
 * @param deadline Time (ms since the epoch) after which no more waiting is allowed.
 * @param folderId Collection folder; 0 is the whole collection.
 */
async function fetchCollectionPage(
  username: string,
  headers: () => Record<string, string>,
  page: number,
  deadline: number,
  folderId = 0
): Promise<DiscogsCollectionResponse> {
  const requestUrl = new URL(
    `${BASE_URL}/users/${username}/collection/folders/${folderId}/releases`
  );

  requestUrl.searchParams.set("per_page", String(COLLECTION_PAGE_SIZE));
  requestUrl.searchParams.set("sort", "artist");
  requestUrl.searchParams.set("page", String(page));

  return makeRequestWithRetry(async () => {
    const response = await fetchDiscogs(
      requestUrl,
      headers(),
      Math.min(REQUEST_TIMEOUT_MS, Math.max(deadline - Date.now(), 1)),
      (status) => `Discogs request failed with status ${status}`
    );
    return (await response.json()) as DiscogsCollectionResponse;
  }, deadline);
}

/**
 * Fetches and normalizes a user's Discogs collection into the frontend album shape.
 *
 * @param getHeaders Reads the credentials, once the username is known to be valid, and returns a
 *   builder for the request headers (a signed-in request needs a new nonce each time).
 * @param folderId Collection folder; 0 is the whole collection.
 * @returns Normalized album array sorted by Discogs artist order.
 */
export async function getUserCollection(
  username: string,
  getHeaders: () => Promise<() => Record<string, string>>,
  folderId = 0
): Promise<Album[]> {
  if (!validateDiscogsUsername(username)) {
    throw new Error(
      "Invalid username format. Usernames should contain only letters, numbers, dots, underscores, or hyphens."
    );
  }

  const deadline = Date.now() + TIME_BUDGET_MS;
  const headers = await getHeaders();
  const firstPage = await fetchCollectionPage(username, headers, 1, deadline, folderId);
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
      pages.map((page) => fetchCollectionPage(username, headers, page, deadline, folderId))
    );
    for (const pageResponse of responses) allReleases.push(...(pageResponse.releases || []));
  }

  return allReleases.map((release) => {
    const basicInfo = release.basic_information;
    const coverImage = basicInfo.cover_image || "";

    return {
      id: release.id,
      title: basicInfo.title || "",
      cover_image: coverImage,
      discogsUrl: getDiscogsReleaseUrl(release),
      artist: extractArtistName(basicInfo.artists),
      genre: basicInfo.genres || [],
      styles: basicInfo.styles || [],
      // Discogs gives 0 when the year is unknown.
      year: basicInfo.year ? String(basicInfo.year) : "",
      label: basicInfo.labels?.[0]?.name ? cleanArtistName(basicInfo.labels[0].name) : "",
      format: extractFormatDetails(basicInfo.formats),
      dateAdded: normalizeDateAdded(release.date_added),
      ...(basicInfo.master_id ? { masterId: basicInfo.master_id } : {}),
    };
  });
}

/**
 * Lists a signed-in visitor's collection folders.
 */
export async function getFolders(
  username: string,
  headers: Record<string, string>
): Promise<{ id: number; name: string; count: number }[]> {
  const response = await fetchDiscogs(
    `${BASE_URL}/users/${username}/collection/folders`,
    headers,
    REQUEST_TIMEOUT_MS,
    () => "Discogs could not list the folders."
  ).catch((error: unknown) => {
    // Any failure to get an answer at all reads as Discogs being slow.
    throw statusOf(error) ? error : httpError("Discogs took too long to respond.", 504);
  });
  const body = (await response.json()) as {
    folders?: { id?: unknown; name?: unknown; count?: unknown }[];
  };
  return (body.folders ?? [])
    .filter((folder) => Number.isInteger(folder.id) && typeof folder.name === "string")
    .map((folder) => ({
      id: folder.id as number,
      name: folder.name as string,
      count: Number.isInteger(folder.count) ? (folder.count as number) : 0,
    }));
}
