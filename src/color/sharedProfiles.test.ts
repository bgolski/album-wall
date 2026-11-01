import { describe, expect, it, vi } from "vitest";
import { packProfile } from "./colorCache";
import type { CoverProfile } from "./coverProfile";
import { fetchSharedProfiles } from "./sharedProfiles";

const SERVICE = "https://service.example/profiles";
const profile: CoverProfile = {
  color: { l: 0.2, a: 0, b: 0 },
  palette: [
    { color: { l: 0.2, a: 0, b: 0 }, share: 0.6 },
    { color: { l: 0.6, a: 0.2, b: 0.1 }, share: 0.4 },
  ],
  regions: Array.from({ length: 9 }, () => ({ l: 0.3, a: 0.05, b: 0.02 })),
};

function answering(handler: (urls: string[]) => Record<string, unknown>) {
  return vi.fn<typeof fetch>(async (_input, init) => {
    const { urls } = JSON.parse(String(init?.body)) as { urls: string[] };
    return new Response(JSON.stringify({ profiles: handler(urls) }), { status: 200 });
  });
}

describe("fetchSharedProfiles", () => {
  it("asks nothing when there is no service", async () => {
    const fetcher = answering(() => ({}));
    const found = await fetchSharedProfiles(["https://x/a.jpg"], { serviceUrl: "", fetcher });
    expect(found.size).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns the profiles it is given, and leaves out the covers it was not", async () => {
    const fetcher = answering((urls) => ({ [urls[0]!]: packProfile(profile) }));
    const found = await fetchSharedProfiles(["https://x/a.jpg", "https://x/b.jpg"], {
      serviceUrl: SERVICE,
      fetcher,
    });
    expect([...found.keys()]).toEqual(["https://x/a.jpg"]);
    expect(found.get("https://x/a.jpg")!.regions).toHaveLength(9);
  });

  it("chooses the main color by the app's current rule, from the palette", async () => {
    const stale = { ...packProfile(profile), c: [0.9, 0.9, 0.9] };
    const found = await fetchSharedProfiles(["https://x/a.jpg"], {
      serviceUrl: SERVICE,
      fetcher: answering((urls) => ({ [urls[0]!]: stale })),
    });
    // The colorful 40% area outweighs the grey 60% one, whatever the service stored.
    expect(found.get("https://x/a.jpg")!.color.a).toBeCloseTo(0.2, 1);
  });

  it("ignores damaged entries and addresses it did not ask about", async () => {
    const fetcher = answering(() => ({
      "https://x/a.jpg": { nonsense: true },
      "https://x/other.jpg": packProfile(profile),
    }));
    const found = await fetchSharedProfiles(["https://x/a.jpg"], { serviceUrl: SERVICE, fetcher });
    expect(found.size).toBe(0);
  });

  it("asks in batches of a hundred", async () => {
    const fetcher = answering(() => ({}));
    const urls = Array.from({ length: 250 }, (_, at) => `https://x/${at}.jpg`);
    await fetchSharedProfiles(urls, { serviceUrl: SERVICE, fetcher });
    const sizes = fetcher.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).urls.length);
    expect(sizes).toEqual([100, 100, 50]);
  });

  it("keeps what it has and stops when the service fails", async () => {
    let call = 0;
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      call += 1;
      if (call === 2) return new Response("no", { status: 503 });
      const { urls } = JSON.parse(String(init?.body)) as { urls: string[] };
      return new Response(JSON.stringify({ profiles: { [urls[0]!]: packProfile(profile) } }), {
        status: 200,
      });
    });
    const urls = Array.from({ length: 300 }, (_, at) => `https://x/${at}.jpg`);
    const found = await fetchSharedProfiles(urls, { serviceUrl: SERVICE, fetcher });
    expect(found.size).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("returns what it has when the request fails outright", async () => {
    const fetcher = vi.fn<typeof fetch>(() => Promise.reject(new TypeError("offline")));
    const found = await fetchSharedProfiles(["https://x/a.jpg"], { serviceUrl: SERVICE, fetcher });
    expect(found.size).toBe(0);
  });
});
