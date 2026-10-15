// Signing in with Discogs. The proxy runs the OAuth steps with the app's consumer secret; the
// visitor's own access token and secret are kept only in this browser's local storage and sent
// with each collection request. The request token's secret, needed once when the visitor comes
// back from Discogs, is held in session storage for that one tab.

/** A signed-in visitor, as kept in local storage. */
export interface DiscogsSession {
  username: string;
  token: string;
  secret: string;
}

/** A sign-in under way: the request token Discogs is asking the visitor to approve. */
export interface PendingSignIn {
  token: string;
  secret: string;
  /** The page's hash when the visitor left (a shared wall), put back on return. */
  returnHash: string;
}

/** A collection folder of the signed-in visitor. */
export interface DiscogsFolder {
  id: number;
  name: string;
  count: number;
}

export const SESSION_KEY = "album-wall:discogs-sign-in";
export const PENDING_KEY = "album-wall:discogs-sign-in-pending";
const TOKEN_PATTERN = /^[A-Za-z0-9]{1,200}$/;
const REQUEST_TIMEOUT_MS = 20_000;

/** Where the visitor can withdraw Album Wall's access on Discogs. */
export const DISCOGS_APPLICATIONS_URL = "https://www.discogs.com/settings/applications";

/** A failed proxy request, with the proxy's reason code when it gave one. */
export class DiscogsProxyError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = "DiscogsProxyError";
  }
}

/**
 * The proxy's reason code on an error, if it has one ("private", "signed-out").
 *
 * @param error Anything thrown.
 * @returns The code, or undefined.
 */
export function proxyErrorCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : undefined;
}

function isToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

/**
 * Reads the signed-in visitor from storage.
 *
 * @param storage Local storage.
 * @returns The session, or null when there is none or it is not valid.
 */
export function loadSession(storage: Pick<Storage, "getItem">): DiscogsSession | null {
  try {
    return parseSession(storage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

/**
 * Parses a stored session.
 *
 * @param raw The stored text.
 * @returns The session, or null.
 */
export function parseSession(raw: string | null): DiscogsSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<DiscogsSession> & { v?: unknown };
    if (value.v !== 1 || typeof value.username !== "string" || !value.username) return null;
    if (!isToken(value.token) || !isToken(value.secret)) return null;
    return { username: value.username, token: value.token, secret: value.secret };
  } catch {
    return null;
  }
}

/**
 * Keeps the signed-in visitor in storage.
 *
 * @param storage Local storage.
 * @param session The session.
 * @returns Whether it was stored.
 */
export function saveSession(storage: Pick<Storage, "setItem">, session: DiscogsSession): boolean {
  try {
    storage.setItem(SESSION_KEY, JSON.stringify({ v: 1, ...session }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Forgets the signed-in visitor.
 *
 * @param storage Local storage.
 */
export function clearSession(storage: Pick<Storage, "removeItem">) {
  try {
    storage.removeItem(SESSION_KEY);
  } catch {
    // Nothing kept.
  }
}

/**
 * Reads the sign-in under way in this tab.
 *
 * @param storage Session storage.
 * @returns It, or null.
 */
export function loadPending(storage: Pick<Storage, "getItem">): PendingSignIn | null {
  try {
    const value = JSON.parse(storage.getItem(PENDING_KEY) ?? "null") as Partial<PendingSignIn>;
    if (!value || !isToken(value.token) || !isToken(value.secret)) return null;
    return {
      token: value.token,
      secret: value.secret,
      returnHash: typeof value.returnHash === "string" ? value.returnHash : "",
    };
  } catch {
    return null;
  }
}

/**
 * Holds a sign-in under way until the visitor comes back from Discogs.
 *
 * @param storage Session storage.
 * @param pending The request token.
 * @returns Whether it was stored.
 */
export function savePending(storage: Pick<Storage, "setItem">, pending: PendingSignIn): boolean {
  try {
    storage.setItem(PENDING_KEY, JSON.stringify(pending));
    return true;
  } catch {
    return false;
  }
}

/**
 * Forgets the sign-in under way.
 *
 * @param storage Session storage.
 */
export function clearPending(storage: Pick<Storage, "removeItem">) {
  try {
    storage.removeItem(PENDING_KEY);
  } catch {
    // Nothing kept.
  }
}

/** What Discogs added to the address when it sent the visitor back. */
export type SignInReturn =
  { kind: "approved"; token: string; verifier: string } | { kind: "denied" } | null;

/**
 * Reads Discogs' answer from the page's query string.
 *
 * @param search `location.search`.
 * @returns The answer, or null when the page was not opened by Discogs.
 */
export function readSignInReturn(search: string): SignInReturn {
  const params = new URLSearchParams(search);
  if (params.has("denied")) return { kind: "denied" };
  const token = params.get("oauth_token");
  const verifier = params.get("oauth_verifier");
  if (isToken(token) && isToken(verifier)) return { kind: "approved", token, verifier };
  return null;
}

/**
 * The `Authorization` header the proxy reads a signed-in visitor from.
 *
 * @param session The signed-in visitor.
 * @returns The header value.
 */
export function authorizationHeader(session: Pick<DiscogsSession, "token" | "secret">): string {
  return `Bearer ${session.token}:${session.secret}`;
}

/**
 * Sends a request to the proxy and reads its JSON answer.
 *
 * @param path Path under the proxy.
 * @param init Request options.
 * @param proxyUrl The proxy address.
 * @returns The answer.
 */
async function callProxy(
  path: string,
  init: RequestInit,
  proxyUrl: string | undefined
): Promise<Record<string, unknown>> {
  if (!proxyUrl) throw new DiscogsProxyError("Signing in with Discogs is not available here.", 0);
  let response: Response;
  try {
    response = await fetch(new URL(path, proxyUrl), {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new DiscogsProxyError("Could not reach Discogs. Please try again.", 0);
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    // Answered below.
  }
  if (!response.ok) {
    // The deployed proxy answers 404 or 405 to these routes until sign-in is set up there.
    const message =
      typeof body.error === "string" && response.status !== 405
        ? body.error
        : "Signing in with Discogs is not available right now.";
    throw new DiscogsProxyError(
      message,
      response.status,
      typeof body.code === "string" ? body.code : undefined
    );
  }
  return body;
}

function postJson(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  };
}

/**
 * Asks the proxy for a request token and the Discogs page where the visitor approves it.
 *
 * @param callback The page Discogs sends the visitor back to.
 * @param proxyUrl The proxy address.
 * @returns The approval page and the request token.
 */
export async function startDiscogsSignIn(
  callback: string,
  proxyUrl = process.env.NEXT_PUBLIC_DISCOGS_PROXY_URL
): Promise<{ authorizeUrl: string; token: string; secret: string }> {
  const body = await callProxy("oauth/start", postJson({ callback }), proxyUrl);
  const { authorizeUrl, token, secret } = body;
  if (
    typeof authorizeUrl !== "string" ||
    !authorizeUrl.startsWith("https://www.discogs.com/oauth/authorize?") ||
    !isToken(token) ||
    !isToken(secret)
  ) {
    throw new DiscogsProxyError("Signing in with Discogs is not available right now.", 502);
  }
  return { authorizeUrl, token, secret };
}

/**
 * Trades the approved request token for the visitor's access token.
 *
 * @param pending The request token held while the visitor was on Discogs.
 * @param verifier The code Discogs added to the address.
 * @param proxyUrl The proxy address.
 * @returns The new session.
 */
export async function finishDiscogsSignIn(
  pending: Pick<PendingSignIn, "token" | "secret">,
  verifier: string,
  proxyUrl = process.env.NEXT_PUBLIC_DISCOGS_PROXY_URL
): Promise<DiscogsSession> {
  const body = await callProxy(
    "oauth/finish",
    postJson({ token: pending.token, secret: pending.secret, verifier }),
    proxyUrl
  );
  const { username, token, secret } = body;
  if (typeof username !== "string" || !username || !isToken(token) || !isToken(secret)) {
    throw new DiscogsProxyError("The sign-in could not be finished. Please try again.", 502);
  }
  return { username, token, secret };
}

/**
 * Lists the signed-in visitor's collection folders.
 *
 * @param session The signed-in visitor.
 * @param proxyUrl The proxy address.
 * @returns The folders, "All" (id 0) first as Discogs lists it.
 */
export async function getCollectionFolders(
  session: DiscogsSession,
  proxyUrl = process.env.NEXT_PUBLIC_DISCOGS_PROXY_URL
): Promise<DiscogsFolder[]> {
  const path = `folders?username=${encodeURIComponent(session.username)}`;
  const body = await callProxy(
    path,
    { headers: { Accept: "application/json", Authorization: authorizationHeader(session) } },
    proxyUrl
  );
  const folders = Array.isArray(body.folders) ? (body.folders as Partial<DiscogsFolder>[]) : [];
  return folders
    .filter((folder) => Number.isInteger(folder.id) && typeof folder.name === "string")
    .map((folder) => ({
      id: folder.id!,
      name: folder.name!,
      count: Number.isInteger(folder.count) ? folder.count! : 0,
    }));
}
