import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A collection load can be cancelled (a new username, leaving the page):
// the caller's AbortSignal reaches fetch, and a cancelled load rejects with
// the AbortError instead of a misleading "no response" message.
const albums = [{ id: 1, title: "Kind of Blue" }];

async function load() {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_DISCOGS_PROXY_URL", "https://proxy.example/collection");
  return import("./discogs");
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("getUserCollection cancellation", () => {
  it("passes the caller's signal to fetch", async () => {
    const { getUserCollection } = await load();
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ albums }), { status: 200 }));
    const controller = new AbortController();
    await getUserCollection("vinylfan", controller.signal);
    const init = vi.mocked(fetch).mock.calls[0]?.[1];
    expect(init?.signal).toBe(controller.signal);
  });

  it("rejects with the AbortError when the load is cancelled", async () => {
    const { getUserCollection } = await load();
    vi.mocked(fetch).mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("The operation was aborted.", "AbortError"))
          );
        })
    );
    const controller = new AbortController();
    const pending = getUserCollection("vinylfan", controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("keeps the network error message when the load was not cancelled", async () => {
    const { getUserCollection } = await load();
    vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(getUserCollection("vinylfan", new AbortController().signal)).rejects.toThrow(
      "No response from the Discogs proxy"
    );
  });

  it("still works without a signal", async () => {
    const { getUserCollection } = await load();
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ albums }), { status: 200 }));
    await expect(getUserCollection("vinylfan")).resolves.toEqual(albums);
  });
});
