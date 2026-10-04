const mockSend = jest.fn();
jest.mock("@aws-sdk/client-ssm", () => ({
  SSMClient: jest.fn(() => ({ send: mockSend })),
  GetParameterCommand: jest.fn((input) => ({ input })),
}));

import { cleanArtistName } from "../lambda/discogs-proxy/index";

type Handler = typeof import("../lambda/discogs-proxy/index").handler;
type HandlerEvent = Parameters<Handler>[0];

// A fresh module per test, so the in-memory SSM cache starts empty.
async function loadHandler() {
  let handler!: Handler;
  jest.isolateModules(() => {
    handler = (jest.requireActual("../lambda/discogs-proxy/index") as { handler: Handler }).handler;
  });
  return handler;
}

function makeEvent(query: Record<string, string> | null, method = "GET"): HandlerEvent {
  return {
    requestContext: { http: { method } },
    queryStringParameters: query,
  } as unknown as HandlerEvent;
}

function bodyOf(response: { body?: string }) {
  return JSON.parse(response.body ?? "null");
}

beforeEach(() => {
  process.env.DISCOGS_TOKEN_PARAMETER_NAME = "/album-wall/discogs-token";
  mockSend.mockReset().mockResolvedValue({ Parameter: { Value: "secret-token" } });
  global.fetch = jest.fn() as unknown as typeof fetch;
  jest.spyOn(console, "error").mockImplementation(() => {});
});

/* -------------------------------------------------- */
/*  cleanArtistName (exported utility)                 */
/* -------------------------------------------------- */

describe("cleanArtistName", () => {
  it.each([
    ["Travis Scott (2)", "Travis Scott"],
    ["Asia (2)", "Asia"],
    ["Prince (12)", "Prince"],
    ["Daft Punk", "Daft Punk"],
    ["Sunn O)))", "Sunn O)))"],
    ["Blink-182", "Blink-182"],
    ["Mumford (and) Sons", "Mumford (and) Sons"],
    ["10cc (2) Live", "10cc (2) Live"],
  ])("%s -> %s", (input, expected) => {
    expect(cleanArtistName(input)).toBe(expected);
  });
});

/* -------------------------------------------------- */
/*  handler — method validation                        */
/* -------------------------------------------------- */

describe("method validation", () => {
  it.each(["POST", "PUT", "DELETE", "PATCH"])("returns 405 for %s", async (method) => {
    const handler = await loadHandler();
    const resp = await handler(makeEvent({ username: "user" }, method));
    expect(resp.statusCode).toBe(405);
  });
});

/* -------------------------------------------------- */
/*  handler — username validation                      */
/* -------------------------------------------------- */

describe("username validation", () => {
  it("returns 400 when username is missing", async () => {
    const handler = await loadHandler();
    const resp = await handler(makeEvent(null));
    expect(resp.statusCode).toBe(400);
  });

  it("returns 400 when username is blank", async () => {
    const handler = await loadHandler();
    const resp = await handler(makeEvent({ username: "" }));
    expect(resp.statusCode).toBe(400);
  });

  it.each(["a", " _", " "])("returns 400 for invalid username %s", async (username) => {
    // If validation let the name through, Discogs would answer 404 instead of the proxy's 400.
    jest
      .mocked(fetch)
      .mockImplementation(() => Promise.resolve(new Response("Not Found", { status: 404 })));
    const handler = await loadHandler();
    const resp = await handler(makeEvent({ username }));
    expect(resp.statusCode).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------- */
/*  handler — SSM caching across calls                 */
/* -------------------------------------------------- */

describe("SSM caching", () => {
  it("caches the token across two handler calls", async () => {
    // A 404 is not retried, so both calls finish at once.
    jest
      .mocked(fetch)
      .mockImplementation(() => Promise.resolve(new Response("Not Found", { status: 404 })));
    const handler = await loadHandler();
    await handler(makeEvent({ username: "cacheduser" }));
    await handler(makeEvent({ username: "cacheduser2" }));
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});

/* -------------------------------------------------- */
/*  handler — artist name formatting                   */
/* -------------------------------------------------- */

describe("artist name formatting", () => {
  it("drops Discogs numbers and joins with separator", async () => {
    const release = (
      id: number,
      artists: { name: string; join?: string }[],
      genres: string[] = []
    ) => ({
      id,
      basic_information: {
        id,
        title: `Album ${id}`,
        cover_image: `c${id}.jpg`,
        artists,
        genres,
      },
    });
    jest.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          pagination: { pages: 1 },
          releases: [
            release(1, [{ name: "Travis Scott (2)" }]),
            release(2, [{ name: "Jay-Z", join: "&" }, { name: "Kanye West (3)" }]),
            release(3, [{ name: "Tony Bennett", join: "Feat." }, { name: "Amy Winehouse" }]),
            release(4, [{ name: "Simon (2)", join: "," }, { name: "Garfunkel" }]),
          ],
        }),
        { status: 200 }
      )
    ) as unknown as typeof fetch;

    const handler = await loadHandler();
    const resp = await handler(makeEvent({ username: "artistuser" }));
    expect(resp.statusCode).toBe(200);
    const { albums } = bodyOf(resp);
    expect(albums.map((a: { artist: string }) => a.artist)).toEqual([
      "Travis Scott",
      "Jay-Z & Kanye West",
      "Tony Bennett Feat. Amy Winehouse",
      "Simon, Garfunkel",
    ]);
  });
});

/* -------------------------------------------------- */
/*  handler — multi-page pagination                    */
/* -------------------------------------------------- */

describe("multi-page pagination", () => {
  it("requests every page and combines results", async () => {
    const handler = await loadHandler();
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            pagination: { pages: 2, page: 1 },
            releases: [
              {
                id: 1,
                basic_information: {
                  id: 1,
                  title: "A1",
                  cover_image: "c1.jpg",
                  artists: [{ name: "Artist A" }],
                  genres: ["Jazz"],
                },
              },
              {
                id: 2,
                basic_information: {
                  id: 2,
                  title: "A2",
                  cover_image: "c2.jpg",
                  artists: [{ name: "Artist B" }],
                  genres: ["Rock"],
                },
              },
              {
                id: 3,
                basic_information: {
                  id: 3,
                  title: "A3",
                  cover_image: "c3.jpg",
                  artists: [{ name: "Artist C" }],
                  genres: [],
                },
              },
            ],
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            pagination: { pages: 2, page: 2 },
            releases: [
              {
                id: 4,
                basic_information: {
                  id: 4,
                  title: "A4",
                  cover_image: "c4.jpg",
                  artists: [{ name: "Artist D" }],
                  genres: ["Pop"],
                },
              },
              {
                id: 5,
                basic_information: {
                  id: 5,
                  title: "A5",
                  cover_image: "c5.jpg",
                  artists: [{ name: "Artist E" }],
                  genres: ["Electronic"],
                },
              },
              {
                id: 6,
                basic_information: {
                  id: 6,
                  title: "A6",
                  cover_image: "c6.jpg",
                  artists: [{ name: "Artist F" }],
                  genres: ["Jazz"],
                },
              },
            ],
          }),
          { status: 200 }
        )
      ) as unknown as typeof fetch;

    const resp = await handler(makeEvent({ username: "paguser" }));
    expect(resp.statusCode).toBe(200);
    const { albums } = bodyOf(resp);
    expect(albums).toHaveLength(6);

    const pages = jest
      .mocked(fetch)
      .mock.calls.map((call) => new URL(String(call[0])).searchParams.get("page"));
    expect(pages.slice(0, 2)).toEqual(["1", "2"]);

    jest.mocked(fetch).mockRestore();
  });
});

/* -------------------------------------------------- */
/*  handler — successful response fields                */
/* -------------------------------------------------- */

describe("response fields", () => {
  it("includes username, correct album fields, and Authorization header", async () => {
    jest.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          pagination: { pages: 1 },
          releases: [
            {
              id: 42,
              basic_information: {
                id: 100,
                title: "Cool Album",
                cover_image: "https://example.com/cover.jpg",
                artists: [{ name: "Cool Artist" }],
                genres: ["Jazz", "Funk"],
              },
            },
          ],
        }),
        { status: 200 }
      )
    ) as unknown as typeof fetch;

    const handler = await loadHandler();
    const resp = await handler(makeEvent({ username: "fielduser" }));
    expect(resp.statusCode).toBe(200);
    const body = bodyOf(resp);
    expect(body.username).toBe("fielduser");
    expect(body.albums).toHaveLength(1);
    const album = body.albums[0];
    expect(album.id).toBe(42);
    expect(album.title).toBe("Cool Album");
    expect(album.cover_image).toBe("https://example.com/cover.jpg");
    expect(album.coverUrl).toBe("https://example.com/cover.jpg");
    expect(album.discogsUrl).toBe("https://www.discogs.com/release/100");
    expect(album.artist).toBe("Cool Artist");
    expect(album.genre).toEqual(["Jazz", "Funk"]);

    const requestInit = jest.mocked(fetch).mock.calls[0]![1] as unknown as {
      headers: Record<string, string>;
    };
    expect(requestInit.headers.Authorization).toBe("Discogs token=secret-token");

    jest.mocked(fetch).mockRestore();
  });
});

/* -------------------------------------------------- */
/*  error handling                                     */
/* -------------------------------------------------- */

describe("404 response", () => {
  it("returns 404 when Discogs user is not found", async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(new Response("Not Found", { status: 404 })) as unknown as typeof fetch;

    const handler = await loadHandler();
    const resp = await handler(makeEvent({ username: "nonexistent" }));
    expect(resp.statusCode).toBe(404);
    const body = bodyOf(resp);
    expect(body.error).toContain("not found");
  });
});

describe("429 response", () => {
  // The proxy currently retries a 429 after 1 s and 2 s before giving up, so this takes about 3 s.
  it("returns 429 on rate limit", async () => {
    jest
      .mocked(fetch)
      .mockImplementation(() => Promise.resolve(new Response("Rate limit", { status: 429 })));

    const handler = await loadHandler();
    const resp = await handler(makeEvent({ username: "ratelimited" }));
    expect(resp.statusCode).toBe(429);
    const body = bodyOf(resp);
    expect(body.error).toContain("Rate limit");
  }, 15000);
});

describe("5xx recovery", () => {
  it("retries on 5xx and returns 200", async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(new Response("Server error", { status: 500 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            pagination: { pages: 1 },
            releases: [
              {
                id: 1,
                basic_information: {
                  id: 1,
                  title: "Recover",
                  cover_image: "r.jpg",
                  artists: [{ name: "Recovery Artist" }],
                  genres: [],
                },
              },
            ],
          }),
          { status: 200 }
        )
      ) as unknown as typeof fetch;

    const handler = await loadHandler();
    const resp = await handler(makeEvent({ username: "recover" }));
    expect(resp.statusCode).toBe(200);
    const body = bodyOf(resp);
    expect(body.albums).toHaveLength(1);
  });
});

describe("5xx exhaustion", () => {
  it("returns 502 after exhausting retries on 5xx", async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(new Response("502", { status: 502 }))
      .mockResolvedValueOnce(new Response("502", { status: 502 }))
      .mockResolvedValueOnce(new Response("502", { status: 502 })) as unknown as typeof fetch;

    jest.setTimeout(10000);
    const handler = await loadHandler();
    const resp = await handler(makeEvent({ username: "norecover" }));
    expect(resp.statusCode).toBe(502);
    const body = bodyOf(resp);
    expect(body.error).toContain("Discogs server error");
  });
});

describe("empty collection", () => {
  it("returns 400 when user has no records", async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ pagination: { pages: 1 }, releases: [] }), { status: 200 })
      ) as unknown as typeof fetch;

    const handler = await loadHandler();
    const resp = await handler(makeEvent({ username: "emptyuser" }));
    expect(resp.statusCode).toBe(400);
    const body = bodyOf(resp);
    expect(body.error).toContain("no vinyl records");

    jest.mocked(fetch).mockRestore();
  });
});
