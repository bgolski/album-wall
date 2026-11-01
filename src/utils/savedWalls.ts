import { authorizationHeader, type DiscogsSession } from "./discogsSignIn";

// Long enough for the proxy to check the sign-in with Discogs, short enough not to hold anything up.
const REQUEST_TIMEOUT_MS = 10_000;
// Both kinds come in one request; layouts and history ask at the same moment.
const LOAD_REUSE_MS = 5_000;

/** What a signed-in visitor keeps in their account for each collection. */
export type SavedKind = "layouts" | "history";
/** One kind as saved: the same JSON text as in local storage, and when it was saved. */
export type SavedEntry = { data: string; updatedAt: string };

/** Reads and writes a signed-in visitor's saved walls through the proxy. */
export interface SavedWallsClient {
  /** The Discogs account the walls belong to. */
  account: string;
  load(collection: string): Promise<Record<SavedKind, SavedEntry | null>>;
  /** Saves one kind; resolves to when it was saved. */
  save(collection: string, kind: SavedKind, data: string): Promise<string>;
  /** Removes everything saved in the account; resolves to how many items went. */
  removeAll(): Promise<number>;
}

/**
 * A client for a signed-in visitor's saved walls.
 *
 * @returns The client, or `null` when there is no proxy.
 */
export function savedWallsClient(
  session: DiscogsSession,
  proxyUrl = process.env.NEXT_PUBLIC_DISCOGS_PROXY_URL
): SavedWallsClient | null {
  if (!proxyUrl) return null;
  const headers = { Accept: "application/json", Authorization: authorizationHeader(session) };

  const call = async (path: string, init: RequestInit = {}) => {
    const response = await fetch(new URL(path, proxyUrl), {
      ...init,
      headers: { ...headers, ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Saved walls answered ${response.status}`);
    return (await response.json()) as Record<string, unknown>;
  };
  const entry = (value: unknown): SavedEntry | null => {
    const candidate = value as Partial<SavedEntry> | null;
    return typeof candidate?.data === "string" && typeof candidate.updatedAt === "string"
      ? { data: candidate.data, updatedAt: candidate.updatedAt }
      : null;
  };

  const loads = new Map<
    string,
    { at: number; result: Promise<Record<SavedKind, SavedEntry | null>> }
  >();
  return {
    account: session.username,
    load(collection) {
      const name = collection.trim().toLowerCase();
      const recent = loads.get(name);
      if (recent && Date.now() - recent.at < LOAD_REUSE_MS) return recent.result;
      const result = call(`saved?collection=${encodeURIComponent(name)}`).then((body) => ({
        layouts: entry(body.layouts),
        history: entry(body.history),
      }));
      loads.set(name, { at: Date.now(), result });
      result.catch(() => loads.delete(name));
      return result;
    },
    async save(collection, kind, data) {
      const name = collection.trim().toLowerCase();
      loads.delete(name);
      const body = await call("saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collection: name, kind, data }),
      });
      if (typeof body.updatedAt !== "string") throw new Error("Saved walls sent no time");
      return body.updatedAt;
    },
    async removeAll() {
      loads.clear();
      const body = await call("saved/delete", { method: "POST" });
      return typeof body.deleted === "number" ? body.deleted : 0;
    },
  };
}
