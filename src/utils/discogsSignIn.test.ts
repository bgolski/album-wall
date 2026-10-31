import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PENDING_KEY,
  SESSION_KEY,
  authorizationHeader,
  clearSession,
  finishDiscogsSignIn,
  getCollectionFolders,
  loadPending,
  parseSession,
  readSignInReturn,
  savePending,
  saveSession,
  startDiscogsSignIn,
} from "./discogsSignIn";
import { clearCachedCollections, writeCachedCollection } from "./collectionCache";

const PROXY = "https://proxy.example/discogs-proxy/";
const SESSION = { username: "Collector", token: "accesstoken", secret: "accesssecret" };

function mockFetch(...responses: Response[]) {
  const fetchMock = vi.fn();
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("stored sign-in", () => {
  it("keeps, reads and forgets the session", () => {
    expect(parseSession(localStorage.getItem(SESSION_KEY))).toBeNull();
    expect(saveSession(localStorage, SESSION)).toBe(true);
    expect(parseSession(localStorage.getItem(SESSION_KEY))).toEqual(SESSION);
    clearSession(localStorage);
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(parseSession(localStorage.getItem(SESSION_KEY))).toBeNull();
  });

  it("ignores a damaged session", () => {
    localStorage.setItem(SESSION_KEY, '{"v":1,"username":"x","token":"a b","secret":"c"}');
    expect(parseSession(localStorage.getItem(SESSION_KEY))).toBeNull();
    localStorage.setItem(SESSION_KEY, "not json");
    expect(parseSession(localStorage.getItem(SESSION_KEY))).toBeNull();
  });

  it("holds the sign-in under way in session storage", () => {
    savePending(sessionStorage, { token: "req", secret: "reqsecret", returnHash: "#share=x" });
    expect(sessionStorage.getItem(PENDING_KEY)).toContain("reqsecret");
    expect(localStorage.length).toBe(0);
    expect(loadPending(sessionStorage)).toEqual({
      token: "req",
      secret: "reqsecret",
      returnHash: "#share=x",
    });
  });

  it("removes only the signed-in user's recently loaded collections", () => {
    writeCachedCollection(sessionStorage, "Collector", [], 1);
    writeCachedCollection(sessionStorage, "Collector#9", [], 1);
    writeCachedCollection(sessionStorage, "Collectors", [], 1);
    clearCachedCollections(sessionStorage, "collector");
    expect(sessionStorage.getItem("album-wall:collection:collector")).toBeNull();
    expect(sessionStorage.getItem("album-wall:collection:collector#9")).toBeNull();
    expect(sessionStorage.getItem("album-wall:collection:collectors")).not.toBeNull();
  });
});

describe("Discogs' answer in the address", () => {
  it.each([
    ["?oauth_token=abc&oauth_verifier=def", { kind: "approved", token: "abc", verifier: "def" }],
    ["?denied=abc", { kind: "denied" }],
    ["", null],
    ["?oauth_token=abc", null],
    ["?oauth_token=a%20b&oauth_verifier=def", null],
  ])("%s", (search, expected) => {
    expect(readSignInReturn(search)).toEqual(expected);
  });

  it("sends the token and secret in one Bearer header", () => {
    expect(authorizationHeader(SESSION)).toBe("Bearer accesstoken:accesssecret");
  });
});

describe("proxy calls", () => {
  it("starts a sign-in with the page as the callback", async () => {
    const fetchMock = mockFetch(
      json({
        authorizeUrl: "https://www.discogs.com/oauth/authorize?oauth_token=req",
        token: "req",
        secret: "reqsecret",
      })
    );
    const started = await startDiscogsSignIn("https://bradleygolski.com/album-wall/", PROXY);
    expect(started.token).toBe("req");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://proxy.example/discogs-proxy/oauth/start");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ callback: "https://bradleygolski.com/album-wall/" });
  });

  it("refuses an approval page that is not on Discogs", async () => {
    mockFetch(json({ authorizeUrl: "https://evil.example/", token: "req", secret: "s" }));
    await expect(
      startDiscogsSignIn("https://bradleygolski.com/album-wall/", PROXY)
    ).rejects.toThrow("not available");
  });

  it("explains a proxy that does not offer sign-in yet", async () => {
    mockFetch(json({ error: "Method not allowed." }, 405));
    await expect(
      startDiscogsSignIn("https://bradleygolski.com/album-wall/", PROXY)
    ).rejects.toThrow("Signing in with Discogs is not available right now.");
  });

  it("finishes a sign-in with the held request token", async () => {
    const fetchMock = mockFetch(json(SESSION));
    const session = await finishDiscogsSignIn({ token: "req", secret: "reqsecret" }, "ver", PROXY);
    expect(session).toEqual(SESSION);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://proxy.example/discogs-proxy/oauth/finish");
    expect(JSON.parse(init.body)).toEqual({ token: "req", secret: "reqsecret", verifier: "ver" });
  });

  it("lists folders as the signed-in visitor", async () => {
    const fetchMock = mockFetch(
      json({
        folders: [
          { id: 0, name: "All", count: 3 },
          { id: 8, name: "Wall", count: 2 },
          { id: "x", name: "bad" },
        ],
      })
    );
    expect(await getCollectionFolders(SESSION, PROXY)).toEqual([
      { id: 0, name: "All", count: 3 },
      { id: 8, name: "Wall", count: 2 },
    ]);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://proxy.example/discogs-proxy/folders?username=Collector");
    expect(init.headers.Authorization).toBe("Bearer accesstoken:accesssecret");
  });
});

describe("loading a collection", () => {
  async function loadDiscogs() {
    vi.stubEnv("NEXT_PUBLIC_DISCOGS_PROXY_URL", PROXY);
    return import("./discogs");
  }

  it("sends no sign-in without a session (the shared-token path)", async () => {
    const fetchMock = mockFetch(json({ albums: [] }));
    const { getUserCollection } = await loadDiscogs();
    await getUserCollection("someone");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://proxy.example/discogs-proxy/?username=someone");
    expect(init.headers).toEqual({ Accept: "application/json" });
  });

  it("sends the visitor's sign-in and folder", async () => {
    const fetchMock = mockFetch(json({ albums: [] }));
    const { getUserCollection } = await loadDiscogs();
    await getUserCollection("Collector", undefined, { session: SESSION, folderId: 8 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(new URL(String(url)).searchParams.get("folder")).toBe("8");
    expect(init.headers.Authorization).toBe("Bearer accesstoken:accesssecret");
  });

  it("passes on the proxy's reason code", async () => {
    mockFetch(json({ error: "private", code: "private" }, 403));
    const { getUserCollection } = await loadDiscogs();
    await expect(getUserCollection("someone")).rejects.toMatchObject({
      code: "private",
      status: 403,
    });
  });
});
