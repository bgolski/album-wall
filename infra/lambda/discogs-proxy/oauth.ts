import { randomBytes } from "node:crypto";
import { APP_ORIGINS } from "./share";

// Discogs sign-in (OAuth 1.0a). The proxy holds the app's consumer secret; each visitor's access
// token and secret stay in their own browser and come with every signed-in request. Nothing here
// is stored, and no token or secret is ever logged.

export const DISCOGS_API = "https://api.discogs.com";
const AUTHORIZE_URL = "https://www.discogs.com/oauth/authorize";
export const USER_AGENT = "AlbumWall/1.0 +https://bradleygolski.com/album-wall/";
const REQUEST_TIMEOUT_MS = 8000;
// Discogs tokens, secrets and verifiers are short runs of letters and digits.
const TOKEN_PATTERN = /^[A-Za-z0-9]{1,200}$/;

export type Consumer = { key: string; secret: string };
export type AccessToken = { token: string; secret: string };

export class SignInError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
  }
}

/**
 * Percent-encodes a value the way OAuth 1.0a requires (RFC 3986 unreserved characters only).
 */
export function oauthEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/**
 * The PLAINTEXT signature: the consumer secret and the token secret, joined by "&". Discogs accepts
 * it over HTTPS.
 *
 * @param tokenSecret The request or access token secret, when there is one.
 */
export function plaintextSignature(consumerSecret: string, tokenSecret = ""): string {
  return `${oauthEncode(consumerSecret)}&${oauthEncode(tokenSecret)}`;
}

/**
 * Builds an `Authorization: OAuth ...` header value.
 *
 * @param extra Other oauth_ parameters (callback, token, verifier).
 * @param tokenSecret Secret of the token being used, when there is one.
 * @param now Current time in milliseconds.
 */
export function oauthHeader(
  consumer: Consumer,
  extra: Record<string, string>,
  tokenSecret = "",
  now = Date.now(),
  nonce = randomBytes(16).toString("hex")
): string {
  const params: Record<string, string> = {
    oauth_consumer_key: consumer.key,
    oauth_nonce: nonce,
    oauth_signature_method: "PLAINTEXT",
    oauth_timestamp: String(Math.floor(now / 1000)),
    oauth_version: "1.0",
    ...extra,
    oauth_signature: plaintextSignature(consumer.secret, tokenSecret),
  };
  return `OAuth ${Object.entries(params)
    .map(([name, value]) => `${name}="${name === "oauth_signature" ? value : oauthEncode(value)}"`)
    .join(", ")}`;
}

/**
 * Headers for a Discogs API request made as a signed-in visitor.
 */
export function signedHeaders(consumer: Consumer, access: AccessToken): Record<string, string> {
  return {
    Authorization: oauthHeader(consumer, { oauth_token: access.token }, access.secret),
    "User-Agent": USER_AGENT,
  };
}

/**
 * Reads the visitor's access token from the request's `Authorization: Bearer <token>:<secret>`
 * header.
 *
 * @param value The header value, if any.
 * @returns The token and secret, null when there is no header, or undefined when it is malformed.
 */
export function readAccessHeader(value: string | undefined): AccessToken | null | undefined {
  if (!value) return null;
  const match = /^Bearer ([A-Za-z0-9]+):([A-Za-z0-9]+)$/.exec(value.trim());
  if (!match || match[1]!.length > 200 || match[2]!.length > 200) return undefined;
  return { token: match[1]!, secret: match[2]! };
}

/**
 * Whether Discogs may send the visitor back to this address after they approve: only the app's
 * own pages, with no query or fragment, so the proxy cannot be used to redirect anywhere else.
 *
 * @returns True when it is allowed.
 */
export function isAllowedCallback(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 300) return false;
  try {
    const url = new URL(value);
    return (
      APP_ORIGINS.has(url.origin) &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password &&
      /^\/[A-Za-z0-9/_-]*$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

/**
 * Checks a token, secret or verifier sent by the app.
 *
 * @returns True when it looks like a Discogs value.
 */
export function isTokenValue(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

/**
 * Posts to one of Discogs' OAuth endpoints and reads its form-encoded answer.
 */
async function postOAuth(path: string, authorization: string): Promise<URLSearchParams> {
  let response: Response;
  try {
    response = await fetch(`${DISCOGS_API}${path}`, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new SignInError("Discogs did not answer. Please try again.", 504);
  }
  if (response.status === 401) {
    throw new SignInError("Discogs did not accept the sign-in. Please try again.", 401);
  }
  if (!response.ok) {
    throw new SignInError(`Discogs sign-in failed (status ${response.status}).`, 502);
  }
  return new URLSearchParams(await response.text());
}

/**
 * First step: asks Discogs for a request token and builds the page where the visitor approves.
 * The request token's secret goes back to the browser, which holds it until the visitor returns
 * (see the infra README for why).
 *
 * @param callback Where Discogs sends the visitor back.
 */
export async function startSignIn(consumer: Consumer, callback: string) {
  const answer = await postOAuth(
    "/oauth/request_token",
    oauthHeader(consumer, { oauth_callback: callback })
  );
  const token = answer.get("oauth_token") ?? "";
  const secret = answer.get("oauth_token_secret") ?? "";
  if (!isTokenValue(token) || !isTokenValue(secret)) {
    throw new SignInError("Discogs sent an unexpected answer.", 502);
  }
  return { authorizeUrl: `${AUTHORIZE_URL}?oauth_token=${oauthEncode(token)}`, token, secret };
}

/**
 * Second step: trades the approved request token for the visitor's access token and finds out
 * who signed in.
 *
 * @param request The request token and secret from the first step.
 * @param verifier The code Discogs added to the address when it sent the visitor back.
 * @returns The access token, its secret and the Discogs username.
 */
export async function finishSignIn(consumer: Consumer, request: AccessToken, verifier: string) {
  const answer = await postOAuth(
    "/oauth/access_token",
    oauthHeader(consumer, { oauth_token: request.token, oauth_verifier: verifier }, request.secret)
  );
  const access = {
    token: answer.get("oauth_token") ?? "",
    secret: answer.get("oauth_token_secret") ?? "",
  };
  if (!isTokenValue(access.token) || !isTokenValue(access.secret)) {
    throw new SignInError("Discogs sent an unexpected answer.", 502);
  }
  const username = await getIdentity(consumer, access);
  return { token: access.token, secret: access.secret, username };
}

/**
 * Asks Discogs whose access token this is.
 */
export async function getIdentity(consumer: Consumer, access: AccessToken): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${DISCOGS_API}/oauth/identity`, {
      headers: signedHeaders(consumer, access),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new SignInError("Discogs did not answer. Please try again.", 504);
  }
  if (response.status === 401) throw new SignInError("Please sign in with Discogs again.", 401);
  if (!response.ok)
    throw new SignInError(`Discogs sign-in failed (status ${response.status}).`, 502);
  const body = (await response.json()) as { username?: unknown };
  if (typeof body.username !== "string" || !body.username) {
    throw new SignInError("Discogs sent an unexpected answer.", 502);
  }
  return body.username;
}
