// Checks the deployed Album Wall from the outside, the way a visitor reaches it: the site, the
// collection cache, the cover image service, short links and the first step of signing in. Nothing
// is written except one short-lived Discogs sign-in token. Run by .github/workflows/live-check.yml
// every week, and by hand with: node scripts/live-check.ts
//
// LIVE_SITE      the site address (default https://bradleygolski.com/album-wall/)
// LIVE_SERVICES  the services' address (default https://albumwall.bradleygolski.com)
// LIVE_USERNAME  a public Discogs collection to load (default bgolski)
export {};

const site = (process.env.LIVE_SITE ?? "https://bradleygolski.com/album-wall/").replace(
  /\/?$/,
  "/"
);
const services = (process.env.LIVE_SERVICES ?? "https://albumwall.bradleygolski.com").replace(
  /\/$/,
  ""
);
const username = process.env.LIVE_USERNAME ?? "bgolski";
const origin = new URL(site).origin;

interface Result {
  name: string;
  problem: string | null;
}
const results: Result[] = [];

async function check(name: string, run: () => Promise<void>) {
  try {
    await run();
    results.push({ name, problem: null });
  } catch (error) {
    results.push({ name, problem: error instanceof Error ? error.message : String(error) });
  }
}

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const get = (url: string, init: RequestInit = {}) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });

let page = "";
let proxyUrl: string | null = null;

await check("the site answers", async () => {
  const response = await get(site);
  expect(response.ok, `status ${response.status}`);
  page = await response.text();
  expect(page.includes("Album Wall"), "the page does not mention Album Wall");
});

await check("the service worker is served", async () => {
  const response = await get(`${site}sw.js`);
  expect(response.ok, `status ${response.status}`);
  expect(/javascript/.test(response.headers.get("content-type") ?? ""), "not a script");
});

// The proxy's address is built into the site's scripts.
await check("the proxy address is built into the site", async () => {
  const scripts = [...page.matchAll(/src="([^"]*_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]!);
  for (const src of scripts) {
    const code = await (await get(new URL(src, site).toString())).text();
    const found = code.match(/https:\/\/[a-z0-9]+\.lambda-url\.[a-z0-9-]+\.on\.aws\//);
    if (found) {
      proxyUrl = found[0];
      return;
    }
  }
  throw new Error("no proxy address found in the site's scripts");
});

await check("a public collection loads, and the second load is cached", async () => {
  const url = `${services}/collection?username=${encodeURIComponent(username)}`;
  const first = await get(url, { headers: { Accept: "application/json", Origin: origin } });
  expect(first.ok, `status ${first.status}`);
  const body = (await first.json()) as { albums?: unknown[] };
  expect(Array.isArray(body.albums) && body.albums.length > 0, "no albums in the answer");
  const second = await get(url, { headers: { Accept: "application/json", Origin: origin } });
  expect(second.ok, `second load status ${second.status}`);
  const cache = second.headers.get("x-cache") ?? "";
  expect(/hit/i.test(cache), `second load was not served from the cache (x-cache: ${cache})`);
});

await check("an unknown collection is an error, and is not kept", async () => {
  const url = `${services}/collection?username=no-such-user-live-check-0000`;
  const response = await get(url, { headers: { Accept: "application/json", Origin: origin } });
  expect(response.status >= 400 && response.status < 500, `status ${response.status}`);
  expect(!/hit/i.test(response.headers.get("x-cache") ?? ""), "an error was served from the cache");
});

await check("the cover image service resizes a cover", async () => {
  const demo = (await (await get(`${site}demo/collection.json`)).json()) as {
    albums?: { coverUrl?: string; cover_image?: string }[];
  };
  const cover = demo.albums?.map((album) => album.coverUrl ?? album.cover_image).find(Boolean);
  expect(cover, "the demo list has no cover address");
  const response = await get(`${services}/img?url=${encodeURIComponent(cover!)}&w=64`, {
    headers: { Origin: origin },
  });
  expect(response.ok, `status ${response.status}`);
  expect(
    /image\//.test(response.headers.get("content-type") ?? ""),
    `not an image (${response.headers.get("content-type")})`
  );
});

await check("an unknown short link is not a server error", async () => {
  const response = await get(`${services}/w/livecheck0`, { redirect: "manual" });
  expect(response.status < 500, `status ${response.status}`);
});

await check("signing in starts: the proxy hands out a Discogs sign-in address", async () => {
  expect(proxyUrl, "the proxy address was not found");
  const response = await get(new URL("oauth/start", proxyUrl!).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ callback: site }),
  });
  expect(response.ok, `status ${response.status}`);
  const body = (await response.json()) as { authorizeUrl?: string };
  expect(
    body.authorizeUrl?.startsWith("https://www.discogs.com/oauth/authorize?"),
    "no Discogs sign-in address in the answer"
  );
});

const failed = results.filter((result) => result.problem);
for (const result of results) {
  console.log(
    `${result.problem ? "FAIL" : "ok  "}  ${result.name}${result.problem ? `: ${result.problem}` : ""}`
  );
}
if (failed.length > 0) {
  console.error(`\n${failed.length} of ${results.length} checks failed`);
  process.exit(1);
}
console.log(`\nAll ${results.length} checks passed`);
