// Album Wall's service worker: the page and its files keep working on a bad or missing connection.
//
// - Pages: the network first, but if it is slow (or gone) the last copy is used.
// - The app's own files under /_next/static/ (their names change with their content), fonts and
//   images: the saved copy first, since it can never be stale.
// - Public collections (the cached collection address) and cover images from the app's own image
//   service: the network first, falling back to the last copy.
// Nothing signed in is ever kept: a request with an Authorization header is left alone, and so is
// anything that is not a plain GET. Opaque responses are not stored (they count far more than their
// size against storage).
//
// The page passes the two outside addresses in the registration URL (?data=...&img=...).

const VERSION = "v1";
const PAGES = `album-wall-pages-${VERSION}`;
const FILES = `album-wall-files-${VERSION}`;
const DATA = `album-wall-data-${VERSION}`;
const COVERS = `album-wall-covers-${VERSION}`;
const ALL = [PAGES, FILES, DATA, COVERS];

// How many entries each store keeps (oldest first out).
const LIMITS = { [FILES]: 150, [DATA]: 12, [COVERS]: 400, [PAGES]: 12 };
// How long the network gets before a saved copy is used instead.
const PAGE_WAIT_MS = 3000;
const DATA_WAIT_MS = 8000;

const params = new URL(self.location.href).searchParams;
const place = (value) => {
  try {
    const url = new URL(value);
    return url.origin + url.pathname;
  } catch {
    return null;
  }
};
const DATA_PLACE = place(params.get("data"));
const COVER_PLACE = place(params.get("img"));
const SCOPE = new URL(self.registration.scope);

self.addEventListener("install", (event) => {
  // The start page is kept straight away, so even the first visit works offline afterwards.
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(PAGES);
        await cache.add(new Request(SCOPE.href, { cache: "reload" }));
        // And the demo wall's list, which the start page checks for.
        const files = await caches.open(FILES);
        await files.add(new Request(`${SCOPE.href}demo/collection.json`));
      } catch {
        // Offline while installing: the page is kept the next time it loads.
      }
      await self.skipWaiting();
    })()
  );
});

// The page lists the files it has already loaded (before this worker took over), so they are
// there offline too. Only the app's own files are taken.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "keep" || !Array.isArray(data.urls)) return;
  event.waitUntil(
    Promise.all(
      data.urls
        .filter((address) => {
          try {
            const url = new URL(address);
            return (
              url.origin === SCOPE.origin &&
              url.pathname.startsWith(SCOPE.pathname + "_next/static/")
            );
          } catch {
            return false;
          }
        })
        .map(async (address) => {
          const request = new Request(address);
          if (await caches.match(request, { cacheName: FILES })) return;
          try {
            await keep(FILES, request, await fetch(request));
          } catch {
            // Not kept; it is fetched when next needed.
          }
        })
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith("album-wall-") && !ALL.includes(n))
          .map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

async function keep(name, request, response) {
  if (!response || !response.ok || (response.type !== "basic" && response.type !== "cors")) return;
  const cache = await caches.open(name);
  await cache.put(request, response);
  const keys = await cache.keys();
  const extra = keys.length - LIMITS[name];
  for (let i = 0; i < extra; i += 1) await cache.delete(keys[i]);
}

/** The network, unless it is slower than `waitMs` or fails and a saved copy exists. */
async function networkFirst(event, name, waitMs, fallback) {
  const request = event.request;
  const saved = async () =>
    (await caches.match(request, { cacheName: name })) ??
    (fallback ? await caches.match(fallback, { cacheName: name }) : undefined);
  const fetched = fetch(request).then((response) => {
    event.waitUntil(keep(name, request, response.clone()));
    return response;
  });
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), waitMs));
  try {
    const first = await Promise.race([fetched, timeout]);
    if (first) return first;
    // Slow: use the saved copy if there is one, otherwise keep waiting for the network.
    return (await saved()) ?? fetched;
  } catch (error) {
    const copy = await saved();
    if (copy) return copy;
    throw error;
  }
}

async function savedFirst(event, name) {
  const copy = await caches.match(event.request, { cacheName: name });
  if (copy) return copy;
  const response = await fetch(event.request);
  event.waitUntil(keep(name, event.request, response.clone()));
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.headers.has("Authorization")) return;
  const url = new URL(request.url);
  const here = url.origin === SCOPE.origin;

  if (!here) {
    const where = url.origin + url.pathname;
    if (DATA_PLACE && where === DATA_PLACE) {
      event.respondWith(networkFirst(event, DATA, DATA_WAIT_MS));
    } else if (COVER_PLACE && where === COVER_PLACE) {
      event.respondWith(networkFirst(event, COVERS, DATA_WAIT_MS));
    }
    return;
  }
  if (!url.pathname.startsWith(SCOPE.pathname)) return;
  const inside = url.pathname.slice(SCOPE.pathname.length);

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(event, PAGES, PAGE_WAIT_MS, SCOPE.href));
  } else if (inside.startsWith("_next/static/") || /\.(?:woff2?|ico|jpg|png|svg)$/.test(inside)) {
    event.respondWith(savedFirst(event, FILES));
  } else if (inside.startsWith("demo/")) {
    event.respondWith(networkFirst(event, FILES, DATA_WAIT_MS));
  }
});
