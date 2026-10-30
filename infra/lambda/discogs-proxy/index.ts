import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
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
import { type FunctionUrlEvent, jsonResponse, readBody, readJsonBody } from "../shared/http";
import { getSecureParameter } from "../shared/parameters";
import { getFolders, getUserCollection, statusOf, validateDiscogsUsername } from "./collection";

// How long CloudFront keeps a public collection: long enough that reloads are quick, short enough
// that new records show up soon.
const PUBLIC_CACHE = "public, max-age=300";

const dynamoClient = new DynamoDBClient({});

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
 * Converts runtime failures into client-facing HTTP responses.
 *
 * @param error Failure thrown while fetching or normalizing the collection.
 * @param username Username associated with the request.
 * @param signedIn Whether the request was made as a signed-in visitor.
 * @returns Consistent JSON error response for the frontend.
 */
function mapErrorToResponse(error: unknown, username: string, signedIn = false) {
  const statusCode = statusOf(error);

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
async function createShortLink(event: FunctionUrlEvent) {
  const tableName = process.env.SHARE_TABLE_NAME;
  const domainParameter = process.env.SHARE_DOMAIN_PARAMETER_NAME;
  if (!tableName || !domainParameter) {
    return jsonResponse(404, { error: "Short links are not set up." });
  }

  try {
    const body = readBody(event);
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
  const statusCode = statusOf(error);
  if (!statusCode) return error.name;
  return `${error.name}: ${error.message} (${statusCode})`;
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
async function startOAuth(event: FunctionUrlEvent) {
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
async function finishOAuth(event: FunctionUrlEvent) {
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
    const folders = await getFolders(username, signedHeaders(await getConsumer(), access));
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
async function savedWalls(event: FunctionUrlEvent, method: string, path: string) {
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
    const body = readBody(event);
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
export async function handler(event: FunctionUrlEvent) {
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
    const albums = await getUserCollection(username, () => getRequestHeaders(access), folderId);

    // A public collection is the same for everyone, so CloudFront may keep it for a few minutes; a
    // signed-in visitor's answer can hold private records and is never kept.
    return jsonResponse(200, { username, albums }, access ? "private, no-store" : PUBLIC_CACHE);
  } catch (error) {
    console.error("Error loading Discogs collection:", describeError(error));
    return mapErrorToResponse(error, username, access !== null);
  }
}
