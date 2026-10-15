const mockSend = jest.fn();
jest.mock("@aws-sdk/client-ssm", () => ({
  SSMClient: jest.fn(() => ({ send: mockSend })),
  GetParameterCommand: jest.fn((input) => ({ input })),
}));

import {
  isAllowedCallback,
  oauthEncode,
  oauthHeader,
  plaintextSignature,
  readAccessHeader,
} from "../lambda/discogs-proxy/oauth";

type Handler = typeof import("../lambda/discogs-proxy/index").handler;
type HandlerEvent = Parameters<Handler>[0];

const PARAMETERS: Record<string, string> = {
  "/album-wall/discogs-token": "shared-token",
  "/album-wall/discogs-consumer-key": "consumer-key",
  "/album-wall/discogs-consumer-secret": "consumersecret",
};
// Every value that must never reach the logs.
const SECRETS = ["shared-token", "consumersecret", "reqsecret", "accesstoken", "accesssecret"];
const APP = "https://bradleygolski.com/album-wall/";

async function loadHandler() {
  let handler!: Handler;
  jest.isolateModules(() => {
    handler = (jest.requireActual("../lambda/discogs-proxy/index") as { handler: Handler }).handler;
  });
  return handler;
}

function post(path: string, body: unknown): HandlerEvent {
  return {
    rawPath: path,
    requestContext: { http: { method: "POST" } },
    body: JSON.stringify(body),
  } as unknown as HandlerEvent;
}

function get(path: string, query: Record<string, string>, authorization?: string): HandlerEvent {
  return {
    rawPath: path,
    requestContext: { http: { method: "GET" } },
    queryStringParameters: query,
    headers: authorization ? { authorization } : {},
  } as unknown as HandlerEvent;
}

function bodyOf(response: { body?: string }) {
  return JSON.parse(response.body ?? "null");
}

function fetchCall(index: number) {
  const [url, init] = jest.mocked(fetch).mock.calls[index]!;
  return { url: String(url), init: init as RequestInit & { headers: Record<string, string> } };
}

/** Reads the parameters of an `OAuth k="v", ...` header. */
function oauthParams(header: string): Record<string, string> {
  expect(header.startsWith("OAuth ")).toBe(true);
  return Object.fromEntries(
    header
      .slice(6)
      .split(", ")
      .map((part) => {
        const [, name, value] = /^([a-z_]+)="(.*)"$/.exec(part)!;
        return [name!, decodeURIComponent(value!)];
      })
  );
}

const collectionPage = () =>
  new Response(
    JSON.stringify({
      pagination: { pages: 1, items: 1 },
      releases: [
        { id: 7, basic_information: { title: "Private Album", artists: [{ name: "A" }] } },
      ],
    }),
    { status: 200 }
  );

let logged: unknown[][];

beforeEach(() => {
  process.env.DISCOGS_TOKEN_PARAMETER_NAME = "/album-wall/discogs-token";
  process.env.DISCOGS_CONSUMER_KEY_PARAMETER_NAME = "/album-wall/discogs-consumer-key";
  process.env.DISCOGS_CONSUMER_SECRET_PARAMETER_NAME = "/album-wall/discogs-consumer-secret";
  mockSend.mockReset().mockImplementation(async (command: { input: { Name: string } }) => ({
    Parameter: { Value: PARAMETERS[command.input.Name] },
  }));
  global.fetch = jest.fn() as unknown as typeof fetch;
  logged = [];
  for (const level of ["log", "info", "warn", "error", "debug"] as const) {
    jest.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logged.push(args);
    });
  }
});

afterEach(() => {
  // Nothing written to the logs may contain a token or secret, whatever the test did.
  const text = logged.map((args) => args.map((arg) => String(arg)).join(" ")).join("\n");
  for (const secret of SECRETS) expect(text).not.toContain(secret);
  jest.restoreAllMocks();
});

describe("signature and header construction", () => {
  it("encodes the way OAuth 1.0a requires", () => {
    expect(oauthEncode("a b!*'()~._-")).toBe("a%20b%21%2A%27%28%29~._-");
  });

  it("joins the consumer and token secrets with &", () => {
    expect(plaintextSignature("c&s", "t s")).toBe("c%26s&t%20s");
    expect(plaintextSignature("cs")).toBe("cs&");
  });

  it("builds a PLAINTEXT header with every required field", () => {
    const header = oauthHeader(
      { key: "ck", secret: "cs" },
      { oauth_token: "tok", oauth_verifier: "ver" },
      "ts",
      1_700_000_000_500,
      "abc"
    );
    expect(header).toBe(
      'OAuth oauth_consumer_key="ck", oauth_nonce="abc", oauth_signature_method="PLAINTEXT", ' +
        'oauth_timestamp="1700000000", oauth_version="1.0", oauth_token="tok", ' +
        'oauth_verifier="ver", oauth_signature="cs&ts"'
    );
  });

  it("uses a new nonce each time", () => {
    const consumer = { key: "ck", secret: "cs" };
    expect(oauthParams(oauthHeader(consumer, {})).oauth_nonce).not.toBe(
      oauthParams(oauthHeader(consumer, {})).oauth_nonce
    );
  });

  it("reads the visitor's token from a Bearer header", () => {
    expect(readAccessHeader(undefined)).toBeNull();
    expect(readAccessHeader("Bearer abc:def")).toEqual({ token: "abc", secret: "def" });
    expect(readAccessHeader("Bearer abc")).toBeUndefined();
    expect(readAccessHeader("Bearer a b:c")).toBeUndefined();
    expect(readAccessHeader("Discogs token=x")).toBeUndefined();
  });

  it.each([
    [APP, true],
    ["https://albumwall.home.bradleygolski.com/album-wall/", true],
    ["http://localhost:3000/", true],
    ["https://evil.example/album-wall/", false],
    ["https://bradleygolski.com.evil.example/", false],
    ["https://bradleygolski.com/album-wall/?next=https://evil.example", false],
    ["https://bradleygolski.com/album-wall/#x", false],
    ["https://user:pw@bradleygolski.com/album-wall/", false],
    ["javascript:alert(1)", false],
    [42, false],
  ])("callback %s allowed: %s", (callback, allowed) => {
    expect(isAllowedCallback(callback)).toBe(allowed);
  });
});

describe("sign-in round trip", () => {
  it("starts, finishes and loads the private collection as the visitor", async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          "oauth_token=reqtoken&oauth_token_secret=reqsecret&oauth_callback_confirmed=true"
        )
      )
      .mockResolvedValueOnce(
        new Response("oauth_token=accesstoken&oauth_token_secret=accesssecret")
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1, username: "Collector" })))
      .mockResolvedValueOnce(collectionPage());
    const handler = await loadHandler();

    const started = await handler(post("/oauth/start", { callback: APP }));
    expect(started.statusCode).toBe(200);
    const start = bodyOf(started);
    expect(start).toEqual({
      authorizeUrl: "https://www.discogs.com/oauth/authorize?oauth_token=reqtoken",
      token: "reqtoken",
      secret: "reqsecret",
    });
    const requestToken = fetchCall(0);
    expect(requestToken.url).toBe("https://api.discogs.com/oauth/request_token");
    expect(requestToken.init.method).toBe("POST");
    expect(requestToken.init.headers["User-Agent"]).toMatch(/^AlbumWall\//);
    expect(oauthParams(requestToken.init.headers.Authorization!)).toMatchObject({
      oauth_consumer_key: "consumer-key",
      oauth_callback: APP,
      oauth_signature: "consumersecret&",
      oauth_signature_method: "PLAINTEXT",
    });

    // The browser comes back from Discogs with the verifier and the secret it held.
    const finished = await handler(
      post("/oauth/finish", { token: start.token, secret: start.secret, verifier: "verifier1" })
    );
    expect(finished.statusCode).toBe(200);
    expect(bodyOf(finished)).toEqual({
      token: "accesstoken",
      secret: "accesssecret",
      username: "Collector",
    });
    const accessToken = fetchCall(1);
    expect(accessToken.url).toBe("https://api.discogs.com/oauth/access_token");
    expect(oauthParams(accessToken.init.headers.Authorization!)).toMatchObject({
      oauth_token: "reqtoken",
      oauth_verifier: "verifier1",
      oauth_signature: "consumersecret&reqsecret",
    });
    const identity = fetchCall(2);
    expect(identity.url).toBe("https://api.discogs.com/oauth/identity");
    expect(oauthParams(identity.init.headers.Authorization!)).toMatchObject({
      oauth_token: "accesstoken",
      oauth_signature: "consumersecret&accesssecret",
    });

    const loaded = await handler(
      get("/", { username: "Collector", folder: "5" }, "Bearer accesstoken:accesssecret")
    );
    expect(loaded.statusCode).toBe(200);
    expect(bodyOf(loaded).albums[0].title).toBe("Private Album");
    const collection = fetchCall(3);
    expect(collection.url).toContain("/users/Collector/collection/folders/5/releases");
    expect(oauthParams(collection.init.headers.Authorization!)).toMatchObject({
      oauth_token: "accesstoken",
      oauth_signature: "consumersecret&accesssecret",
    });
    // Nothing returned or sent anywhere else carries the shared token.
    expect(JSON.stringify(jest.mocked(fetch).mock.calls)).not.toContain("shared-token");
  });

  it("refuses a callback outside the app without contacting Discogs", async () => {
    const handler = await loadHandler();
    const response = await handler(post("/oauth/start", { callback: "https://evil.example/" }));
    expect(response.statusCode).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses a finish with missing or odd values", async () => {
    const handler = await loadHandler();
    for (const body of [
      {},
      { token: "a", secret: "b" },
      { token: "a b", secret: "b", verifier: "c" },
    ]) {
      expect((await handler(post("/oauth/finish", body))).statusCode).toBe(400);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("passes on a refused verifier without logging the secrets", async () => {
    jest.mocked(fetch).mockResolvedValueOnce(new Response("Invalid verifier", { status: 401 }));
    const handler = await loadHandler();
    const response = await handler(
      post("/oauth/finish", { token: "reqtoken", secret: "reqsecret", verifier: "bad" })
    );
    expect(response.statusCode).toBe(401);
  });

  it("logs a Discogs failure without any token or secret", async () => {
    jest.mocked(fetch).mockRejectedValue(new Error("connect failed accesstoken accesssecret"));
    const handler = await loadHandler();
    expect((await handler(post("/oauth/start", { callback: APP }))).statusCode).toBe(504);
    const response = await handler(
      get("/", { username: "Collector" }, "Bearer accesstoken:accesssecret")
    );
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(logged.length).toBeGreaterThan(0);
  });
});

describe("signed-in requests", () => {
  it("lists the visitor's folders", async () => {
    jest.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          folders: [
            { id: 0, name: "All", count: 75 },
            { id: 1, name: "Uncategorized", count: 70 },
            { id: 9, name: "Wall", count: 5, resource_url: "x" },
            { name: "broken" },
          ],
        })
      )
    );
    const handler = await loadHandler();
    const response = await handler(
      get("/folders", { username: "Collector" }, "Bearer accesstoken:accesssecret")
    );
    expect(response.statusCode).toBe(200);
    expect(bodyOf(response).folders).toEqual([
      { id: 0, name: "All", count: 75 },
      { id: 1, name: "Uncategorized", count: 70 },
      { id: 9, name: "Wall", count: 5 },
    ]);
    expect(fetchCall(0).url).toBe("https://api.discogs.com/users/Collector/collection/folders");
  });

  it("needs a sign-in for folders", async () => {
    const handler = await loadHandler();
    expect((await handler(get("/folders", { username: "Collector" }))).statusCode).toBe(401);
    expect((await handler(get("/", { username: "Collector", folder: "3" }))).statusCode).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects a malformed sign-in header and a bad folder", async () => {
    const handler = await loadHandler();
    expect((await handler(get("/", { username: "Collector" }, "Bearer nope"))).statusCode).toBe(
      401
    );
    expect(
      (await handler(get("/", { username: "Collector", folder: "-1" }, "Bearer a:b"))).statusCode
    ).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("tells a signed-in visitor whose token Discogs no longer accepts to sign in again", async () => {
    jest.mocked(fetch).mockResolvedValueOnce(new Response("", { status: 401 }));
    const handler = await loadHandler();
    const response = await handler(
      get("/", { username: "Collector" }, "Bearer accesstoken:accesssecret")
    );
    expect(response.statusCode).toBe(401);
    expect(bodyOf(response).code).toBe("signed-out");
  });
});

describe("shared-token path", () => {
  it("still uses the shared token and never reads the consumer secret", async () => {
    jest.mocked(fetch).mockResolvedValueOnce(collectionPage());
    const handler = await loadHandler();
    const response = await handler(get("/", { username: "someone" }));
    expect(response.statusCode).toBe(200);
    expect(fetchCall(0).init.headers.Authorization).toBe("Discogs token=shared-token");
    expect(fetchCall(0).url).toContain("/collection/folders/0/releases");
    const names = mockSend.mock.calls.map((call) => call[0].input.Name);
    expect(names).toEqual(["/album-wall/discogs-token"]);
  });

  it("explains a private collection", async () => {
    jest.mocked(fetch).mockResolvedValueOnce(new Response("", { status: 403 }));
    const handler = await loadHandler();
    const response = await handler(get("/", { username: "someone" }));
    expect(response.statusCode).toBe(403);
    expect(bodyOf(response)).toMatchObject({ code: "private" });
    expect(bodyOf(response).error).toMatch(/private on Discogs/);
  });
});
