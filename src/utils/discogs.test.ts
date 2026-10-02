import { describe, it, expect, vi, afterEach } from "vitest";
import { validateDiscogsUsername } from "./discogs";

// Helper to import the module under test with a fresh environment
async function loadDiscogsModule(env: Record<string, string | undefined> = {}) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }
  return await import("./discogs");
}

// Reset mocks after each test
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("validateDiscogsUsername", () => {
  it("returns true for valid usernames", () => {
    expect(validateDiscogsUsername("john_doe")).toBe(true);
    expect(validateDiscogsUsername("alice123")).toBe(true);
    expect(validateDiscogsUsername("bob.smith")).toBe(true);
  });

  it("returns false for invalid usernames", () => {
    expect(validateDiscogsUsername("u")).toBe(false); // too short
    expect(validateDiscogsUsername("john doe")).toBe(false); // space
    expect(validateDiscogsUsername("john@doe")).toBe(false); // invalid char
  });
});

describe("getUserCollection", () => {
  const proxyUrl = "https://proxy.example/collection";

  it("throws when proxy URL is not configured", async () => {
    // This test must run first before any stubEnv calls set the proxy URL
    const { getUserCollection } = await loadDiscogsModule();
    await expect(getUserCollection("validUser")).rejects.toThrow(
      "Discogs proxy URL is not configured"
    );
  });

  it("throws when username is empty", async () => {
    const { getUserCollection } = await loadDiscogsModule({
      NEXT_PUBLIC_DISCOGS_PROXY_URL: proxyUrl,
    });
    await expect(getUserCollection("")).rejects.toThrow("Username cannot be empty");
  });

  it("throws when username format is invalid", async () => {
    const { getUserCollection } = await loadDiscogsModule({
      NEXT_PUBLIC_DISCOGS_PROXY_URL: proxyUrl,
    });
    await expect(getUserCollection("invalid@user")).rejects.toThrow("Invalid username format");
  });

  it("throws on network failure", async () => {
    const { getUserCollection } = await loadDiscogsModule({
      NEXT_PUBLIC_DISCOGS_PROXY_URL: proxyUrl,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("network")))
    );
    await expect(getUserCollection("validUser")).rejects.toThrow(
      "No response from the Discogs proxy"
    );
  });

  it("throws when 404 is returned", async () => {
    const { getUserCollection } = await loadDiscogsModule({
      NEXT_PUBLIC_DISCOGS_PROXY_URL: proxyUrl,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(null, {
            status: 404,
            statusText: "Not Found",
            headers: { "Content-Type": "application/json" },
          })
        )
      )
    );
    await expect(getUserCollection("missingUser")).rejects.toThrow(
      'User "missingUser" not found on Discogs'
    );
  });

  it("throws when 429 is returned", async () => {
    const { getUserCollection } = await loadDiscogsModule({
      NEXT_PUBLIC_DISCOGS_PROXY_URL: proxyUrl,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(null, {
            status: 429,
            statusText: "Too Many Requests",
            headers: { "Content-Type": "application/json" },
          })
        )
      )
    );
    await expect(getUserCollection("user")).rejects.toThrow("Rate limit exceeded");
  });

  it("throws on 5xx responses", async () => {
    const { getUserCollection } = await loadDiscogsModule({
      NEXT_PUBLIC_DISCOGS_PROXY_URL: proxyUrl,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(null, {
            status: 502,
            statusText: "Bad Gateway",
            headers: { "Content-Type": "application/json" },
          })
        )
      )
    );
    await expect(getUserCollection("user")).rejects.toThrow(
      "Discogs proxy error. Please try again later"
    );
  });

  it("throws the error message from body when present", async () => {
    const { getUserCollection } = await loadDiscogsModule({
      NEXT_PUBLIC_DISCOGS_PROXY_URL: proxyUrl,
    });
    const body = { error: "Invalid token" };
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify(body), {
            status: 400,
            statusText: "Bad Request",
            headers: { "Content-Type": "application/json" },
          })
        )
      )
    );
    await expect(getUserCollection("user")).rejects.toThrow("Invalid token");
  });

  it("throws generic error when status not handled and body has no error", async () => {
    const { getUserCollection } = await loadDiscogsModule({
      NEXT_PUBLIC_DISCOGS_PROXY_URL: proxyUrl,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({}), {
            status: 400,
            statusText: "Bad Request",
            headers: { "Content-Type": "application/json" },
          })
        )
      )
    );
    await expect(getUserCollection("user")).rejects.toThrow(
      "Discogs proxy error: 400 - Bad Request"
    );
  });

  it("throws when collection is empty", async () => {
    const { getUserCollection } = await loadDiscogsModule({
      NEXT_PUBLIC_DISCOGS_PROXY_URL: proxyUrl,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ albums: [] }), {
            status: 200,
            statusText: "OK",
            headers: { "Content-Type": "application/json" },
          })
        )
      )
    );
    await expect(getUserCollection("user")).rejects.toThrow(
      "has no vinyl records in their collection"
    );
  });

  it("returns albums on successful fetch", async () => {
    const { getUserCollection } = await loadDiscogsModule({
      NEXT_PUBLIC_DISCOGS_PROXY_URL: proxyUrl,
    });
    const albums = [{ id: 1, title: "Test" }];
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ albums }), {
            status: 200,
            statusText: "OK",
            headers: { "Content-Type": "application/json" },
          })
        )
      )
    );
    const result = await getUserCollection("user");
    expect(result).toEqual(albums);
  });
});
