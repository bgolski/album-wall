import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { ShareInputError, parseShareRequest, storeSharedWall } from "./share";
import {
  IdentityCache,
  SavedInputError,
  collectionName,
  deleteAllSaved,
  loadSaved,
  parseSavedRequest,
  storeSaved,
} from "./saved";
import {
  AccessToken,
  Consumer,
  DISCOGS_API,
  SignInError,
  USER_AGENT,
  finishSignIn,
  getIdentity,
  isAllowedCallback,
  isTokenValue,
  readAccessHeader,
  signedHeaders,
  startSignIn,
} from "./oauth";

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

type Album = {
  id: number;
  title: string;
  cover_image?: string;
  coverUrl?: string;
  discogsUrl?: string | undefined;
  artist: string;
  genre?: string[];
  styles?: string[];
  year?: string;
  label?: string;
  format?: string[];
  dateAdded?: string;
};

type LambdaEvent = {
  rawPath?: string;
  headers?: Record<string, string | undefined> | null;
  body?: string | null;
  isBase64Encoded?: boolean;
  queryStringParameters?: Record<string, string | undefined> | null;
  requestContext?: {
    http?: {
      method?: string;
    };
  };
};

const ssmClient = new SSMClient({});
const dynamoClient = new DynamoDBClient({});
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
 * Lists a release's format details, such as "LP", "Album", "Reissue" or a vinyl color, once each
 * in Discogs order. The format name itself ("Vinyl") says nothing on a record wall.
 *
 * @param formats Discogs format entries for the release.
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
 * @param headers Builds the request headers (a signed-in request needs a new nonce each time).
 * @param page Collection page number to fetch.
 * @param deadline Time (ms since the epoch) after which no more waiting is allowed.
 * @param folderId Collection folder; 0 is the whole collection.
 * @returns One page of the Discogs collection response.
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
    let response: Response;

    try {
      response = await fetch(requestUrl, {
        headers: headers(),
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
 * Reads the app's consumer key and secret.
 *
 * @returns The consumer key and secret.
 */
async function getConsumer(): Promise<Consumer> {
  const keyName = process.env.DISCOGS_CONSUMER_KEY_PARAMETER_NAME;
  const secretName = process.env.DISCOGS_CONSUMER_SECRET_PARAMETER_NAME;
  if (!keyName || !secretName) {
    throw new SignInError("Signing in with Discogs is not set up.", 404);
  }
  const [key, secret] = await Promise.all([
    getSecureParameter(keyName),
    getSecureParameter(secretName),
  ]);
  return { key, secret };
}

/**
 * Request headers for Discogs: signed as the visitor when they signed in, otherwise with the
 * app's shared token.
 *
 * @param access The visitor's access token, when signed in.
 * @returns A function that builds the headers for one request.
 */
async function getRequestHeaders(
  access: AccessToken | null
): Promise<() => Record<string, string>> {
  if (access) {
    const consumer = await getConsumer();
    return () => signedHeaders(consumer, access);
  }

  const tokenParameterName = process.env.DISCOGS_TOKEN_PARAMETER_NAME;

  if (!tokenParameterName) {
    throw new Error("Lambda is missing DISCOGS_TOKEN_PARAMETER_NAME.");
  }

  const token = await getSecureParameter(tokenParameterName);
  return () => ({ Authorization: `Discogs token=${token}`, "User-Agent": USER_AGENT });
}

/**
 * Fetches and normalizes a user's Discogs collection into the frontend album shape.
 *
 * @param username Discogs username whose collection should be loaded.
 * @param access The visitor's access token, when signed in.
 * @param folderId Collection folder; 0 is the whole collection.
 * @returns Normalized album array sorted by Discogs artist order.
 */
async function getUserCollection(
  username: string,
  access: AccessToken | null = null,
  folderId = 0
): Promise<Album[]> {
  if (!username.trim()) {
    throw new Error("Username cannot be empty");
  }

  if (!validateDiscogsUsername(username)) {
    throw new Error(
      "Invalid username format. Usernames should contain only letters, numbers, dots, underscores, or hyphens."
    );
  }

  const deadline = Date.now() + TIME_BUDGET_MS;
  const headers = await getRequestHeaders(access);
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
      styles: basicInfo.styles || [],
      // Discogs gives 0 when the year is unknown.
      year: basicInfo.year ? String(basicInfo.year) : "",
      label: basicInfo.labels?.[0]?.name ? cleanArtistName(basicInfo.labels[0].name) : "",
      format: extractFormatDetails(basicInfo.formats),
      dateAdded: normalizeDateAdded(release.date_added),
    };
  });
}

/**
 * Converts runtime failures into client-facing HTTP responses.
 *
 * @param error Failure thrown while fetching or normalizing the collection.
 * @param username Username associated with the request.
 * @param signedIn Whether the request was made as a signed-in visitor.
 * @returns Consistent JSON error response for the frontend.
 */
function mapErrorToResponse(error: unknown, username: string, signedIn = false) {
  const statusCode =
    error instanceof Error && "statusCode" in error
      ? Number((error as Error & { statusCode?: number }).statusCode)
      : undefined;

  if (statusCode === 403) {
    return jsonResponse(403, {
      code: "private",
      error: signedIn
        ? `Discogs does not let this account see that collection or folder.`
        : `The collection of "${username}" is private on Discogs. Its owner can sign in with Discogs to load it.`,
    });
  }

  if (statusCode === 401 && signedIn) {
    return jsonResponse(401, {
      code: "signed-out",
      error: "Your Discogs sign-in has ended. Please sign in again.",
    });
  }

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
 * Stores a shared wall and answers with its short link (`POST /share`).
 *
 * @param event Function URL request with the wall as JSON.
 * @returns `{ url }`, or an error.
 */
async function createShortLink(event: LambdaEvent) {
  const tableName = process.env.SHARE_TABLE_NAME;
  const domainParameter = process.env.SHARE_DOMAIN_PARAMETER_NAME;
  if (!tableName || !domainParameter) {
    return jsonResponse(404, { error: "Short links are not set up." });
  }

  try {
    const body = event.isBase64Encoded
      ? Buffer.from(event.body ?? "", "base64").toString("utf-8")
      : (event.body ?? "");
    const id = await storeSharedWall(dynamoClient, tableName, parseShareRequest(body));
    const domain = await getSecureParameter(domainParameter);
    return jsonResponse(200, { url: `https://${domain}/w/${id}` });
  } catch (error) {
    if (error instanceof ShareInputError) return jsonResponse(400, { error: error.message });
    console.error("Error storing a shared wall:", error);
    return jsonResponse(503, { error: "Could not make a short link." });
  }
}

/**
 * Describes an error for the logs without anything it might carry from a request: only its kind,
 * message (always written by this proxy) and status.
 *
 * @param error The error.
 * @returns A short description.
 */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return "Unknown error";
  // Errors without a status come from elsewhere (the network, the runtime); only their kind is
  // kept, in case their text repeats part of a request.
  const statusCode = (error as DiscogsError).statusCode;
  if (!statusCode) return error.name;
  return `${error.name}: ${error.message} (${statusCode})`;
}

/**
 * Reads a JSON request body.
 *
 * @param event Function URL request.
 * @returns The parsed body, or null when it is missing or not a JSON object.
 */
function readJsonBody(event: LambdaEvent): Record<string, unknown> | null {
  const text = event.isBase64Encoded
    ? Buffer.from(event.body ?? "", "base64").toString("utf-8")
    : (event.body ?? "");
  if (text.length > 4000) return null;
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Answers a sign-in failure.
 *
 * @param error The failure.
 * @returns A JSON error response.
 */
function signInErrorResponse(error: unknown) {
  if (error instanceof SignInError) {
    if (error.statusCode >= 500) console.error("Discogs sign-in failed:", describeError(error));
    return jsonResponse(error.statusCode, { error: error.message });
  }
  console.error("Discogs sign-in failed:", describeError(error));
  return jsonResponse(500, { error: "Signing in with Discogs failed. Please try again." });
}

/**
 * Starts a Discogs sign-in (`POST /oauth/start` with `{ callback }`).
 *
 * @param event Function URL request.
 * @returns The Discogs approval page plus the request token and secret for the browser to hold.
 */
async function startOAuth(event: LambdaEvent) {
  const callback = readJsonBody(event)?.callback;
  if (!isAllowedCallback(callback)) {
    return jsonResponse(400, { error: "Sign-in is only possible from the Album Wall app." });
  }
  try {
    return jsonResponse(200, await startSignIn(await getConsumer(), callback));
  } catch (error) {
    return signInErrorResponse(error);
  }
}

/**
 * Finishes a Discogs sign-in (`POST /oauth/finish` with `{ token, secret, verifier }`).
 *
 * @param event Function URL request.
 * @returns The visitor's access token and secret, for their browser to keep, and their username.
 */
async function finishOAuth(event: LambdaEvent) {
  const body = readJsonBody(event);
  const { token, secret, verifier } = body ?? {};
  if (!isTokenValue(token) || !isTokenValue(secret) || !isTokenValue(verifier)) {
    return jsonResponse(400, { error: "The sign-in could not be finished. Please try again." });
  }
  try {
    return jsonResponse(200, await finishSignIn(await getConsumer(), { token, secret }, verifier));
  } catch (error) {
    return signInErrorResponse(error);
  }
}

/**
 * Lists the signed-in visitor's collection folders (`GET /folders?username=`).
 *
 * @param username The visitor's Discogs username.
 * @param access The visitor's access token.
 * @returns `{ folders: [{ id, name, count }] }`, or an error.
 */
async function listFolders(username: string, access: AccessToken) {
  try {
    const headers = signedHeaders(await getConsumer(), access);
    let response: Response;
    try {
      response = await fetch(`${BASE_URL}/users/${username}/collection/folders`, {
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw httpError("Discogs took too long to respond.", 504);
    }
    if (!response.ok) throw httpError("Discogs could not list the folders.", response.status);
    const body = (await response.json()) as {
      folders?: { id?: unknown; name?: unknown; count?: unknown }[];
    };
    const folders = (body.folders ?? [])
      .filter((folder) => Number.isInteger(folder.id) && typeof folder.name === "string")
      .map((folder) => ({
        id: folder.id as number,
        name: folder.name as string,
        count: Number.isInteger(folder.count) ? (folder.count as number) : 0,
      }));
    return jsonResponse(200, { folders });
  } catch (error) {
    console.error("Error listing Discogs folders:", describeError(error));
    return mapErrorToResponse(error, username, true);
  }
}

const identities = new IdentityCache(async (token, secret) =>
  getIdentity(await getConsumer(), { token, secret })
);

/**
 * A signed-in visitor's saved layouts and wall history: `GET /saved?collection=` reads a
 * collection's, `POST /saved` with `{ collection, kind, data }` saves one kind, and
 * `POST /saved/delete` removes everything. Only the Discogs account the sign-in belongs to is
 * ever read or written.
 *
 * @param event Function URL request.
 * @param method HTTP method.
 * @param path Request path without a trailing slash.
 * @returns The saved data, when it was saved, or an error.
 */
async function savedWalls(event: LambdaEvent, method: string, path: string) {
  const table = process.env.SAVED_TABLE_NAME;
  if (!table) return jsonResponse(404, { error: "Saving walls to an account is not set up." });
  const headers = event.headers ?? {};
  const access = readAccessHeader(headers.authorization ?? headers.Authorization);
  if (!access) {
    return jsonResponse(401, { code: "signed-out", error: "Sign in with Discogs to save walls." });
  }

  let user: string;
  try {
    user = await identities.userFor(access.token, access.secret);
  } catch (error) {
    return signInErrorResponse(error);
  }

  try {
    if (method === "GET") {
      const collection = collectionName(event.queryStringParameters?.collection);
      if (!collection) return jsonResponse(400, { error: "Missing or invalid collection." });
      return jsonResponse(200, await loadSaved(dynamoClient, table, user, collection));
    }
    if (path.endsWith("/saved/delete")) {
      return jsonResponse(200, { deleted: await deleteAllSaved(dynamoClient, table, user) });
    }
    const body = event.isBase64Encoded
      ? Buffer.from(event.body ?? "", "base64").toString("utf-8")
      : (event.body ?? "");
    const updatedAt = await storeSaved(dynamoClient, table, user, parseSavedRequest(body));
    return jsonResponse(200, { updatedAt });
  } catch (error) {
    if (error instanceof SavedInputError) return jsonResponse(400, { error: error.message });
    console.error("Error with saved walls:", describeError(error));
    return jsonResponse(503, { error: "Saved walls are not available right now." });
  }
}

/**
 * Lambda Function URL handler for the Discogs collection proxy, which also signs visitors in with
 * Discogs (`POST /oauth/start`, `POST /oauth/finish`), lists their folders (`GET /folders`), keeps
 * their saved walls (`/saved`) and makes short share links (`POST /share`).
 *
 * @param event Function URL request event with query parameters.
 * @returns Normalized album payload or a descriptive error response.
 */
export async function handler(event: LambdaEvent) {
  const method = event.requestContext?.http?.method ?? "GET";
  const path = event.rawPath?.replace(/\/+$/, "") ?? "";

  if (method === "POST" && path.endsWith("/share")) {
    return createShortLink(event);
  }

  if (method === "POST" && path.endsWith("/oauth/start")) return startOAuth(event);
  if (method === "POST" && path.endsWith("/oauth/finish")) return finishOAuth(event);
  if (
    (method === "GET" && path.endsWith("/saved")) ||
    (method === "POST" && (path.endsWith("/saved") || path.endsWith("/saved/delete")))
  ) {
    return savedWalls(event, method, path);
  }

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

  const headers = event.headers ?? {};
  const access = readAccessHeader(headers.authorization ?? headers.Authorization);
  if (access === undefined) {
    return jsonResponse(401, {
      code: "signed-out",
      error: "Your Discogs sign-in could not be read. Please sign in again.",
    });
  }

  if (path.endsWith("/folders")) {
    if (!access)
      return jsonResponse(401, { code: "signed-out", error: "Sign in to list folders." });
    if (!validateDiscogsUsername(username)) {
      return jsonResponse(400, { error: "Invalid username format." });
    }
    return listFolders(username, access);
  }

  const folderText = event.queryStringParameters?.folder ?? "0";
  const folderId = /^\d{1,10}$/.test(folderText) ? Number(folderText) : -1;
  if (folderId < 0 || folderId > 2 ** 31) {
    return jsonResponse(400, { error: "Invalid folder." });
  }
  if (folderId !== 0 && !access) {
    return jsonResponse(401, {
      code: "signed-out",
      error: "Sign in with Discogs to load a folder.",
    });
  }

  try {
    const albums = await getUserCollection(username, access, folderId);

    return jsonResponse(200, {
      username,
      albums,
    });
  } catch (error) {
    console.error("Error loading Discogs collection:", describeError(error));
    return mapErrorToResponse(error, username, access !== null);
  }
}
