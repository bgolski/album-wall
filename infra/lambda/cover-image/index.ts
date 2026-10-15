import sharp from "sharp";

// The sizes the app asks for: measuring colors, wall tiles, and saved images.
export const WIDTHS = [64, 320, 600] as const;
const FETCH_TIMEOUT_MS = 8000;
const MAX_SOURCE_BYTES = 8_000_000;
const MAX_SOURCE_PIXELS = 40_000_000;
// Cover Art Archive answers with a redirect to archive.org, which may redirect again.
const MAX_REDIRECTS = 4;
// archive.org sometimes answers 500 when many covers are asked for at once, then serves them.
const SERVER_ERROR_RETRY_MS = 300;
const USER_AGENT = "AlbumWall/1.0 (+https://bradleygolski.com/album-wall/)";
const IMAGE_CACHE = "public, max-age=31536000, immutable";
// A bad request stays bad, and a missing cover rarely comes back, so both are cached a while.
const BAD_REQUEST_CACHE = "public, max-age=86400";
const NOT_FOUND_CACHE = "public, max-age=3600";

type ImageEvent = {
  rawPath?: string;
  rawQueryString?: string;
  requestContext?: { http?: { method?: string } };
};

type ImageResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
};

class SourceError extends Error {
  readonly notFound: boolean;
  readonly retryable: boolean;

  constructor(message: string, options: { notFound?: boolean; retryable?: boolean } = {}) {
    super(message);
    this.notFound = options.notFound ?? false;
    this.retryable = options.retryable ?? false;
  }
}

/**
 * Whether the service may fetch an address: HTTPS on the default port, from Discogs' image hosts,
 * Cover Art Archive, or archive.org (where Cover Art Archive keeps its images), so it cannot be
 * used as an open proxy.
 *
 * @param value Address to check.
 * @returns The parsed address, or null when it is not allowed.
 */
export function allowedCoverUrl(value: string): URL | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.port || url.username || url.password) return null;
  const host = url.hostname;
  const allowed =
    host === "i.discogs.com" ||
    host === "st.discogs.com" ||
    host === "coverartarchive.org" ||
    host === "archive.org" ||
    host.endsWith(".archive.org");
  return allowed ? url : null;
}

function respond(statusCode: number, body: string, cacheControl: string): ImageResponse {
  return {
    statusCode,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": cacheControl,
      "access-control-allow-origin": "*",
    },
    body,
  };
}

/** Reads the request: the cover address and one of the allowed widths, and nothing else. */
function parseRequest(event: ImageEvent): { url: URL; width: number } | string {
  const method = event.requestContext?.http?.method ?? "GET";
  if (method !== "GET" && method !== "HEAD") return "Only GET is supported.";
  if (event.rawPath !== "/img") return "Unknown path.";
  const params = new URLSearchParams(event.rawQueryString ?? "");
  const names = [...params.keys()];
  if (names.length !== 2 || new Set(names).size !== 2) return "Expected url and w.";
  const width = Number(params.get("w"));
  if (!WIDTHS.includes(width as (typeof WIDTHS)[number]) || params.get("w") !== String(width)) {
    return `w must be one of ${WIDTHS.join(", ")}.`;
  }
  const url = allowedCoverUrl(params.get("url") ?? "");
  if (!url) return "url is not an allowed cover address.";
  return { url, width };
}

/** Reads a response body, giving up once it passes the size limit. */
async function readLimited(response: Response): Promise<Buffer> {
  const declared = Number(response.headers.get("content-length"));
  if (declared > MAX_SOURCE_BYTES) throw new SourceError("Cover is too large.");
  if (!response.body) throw new SourceError("Cover is empty.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_SOURCE_BYTES) {
      await reader.cancel();
      throw new SourceError("Cover is too large.");
    }
    chunks.push(value);
  }
  if (total === 0) throw new SourceError("Cover is empty.");
  return Buffer.concat(chunks);
}

/**
 * Downloads a cover, following redirects only to allowed hosts, and trying once more when a host
 * has a server error.
 *
 * @param start Allowed cover address.
 * @returns The cover's bytes.
 */
export async function fetchCover(start: URL): Promise<Buffer> {
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  try {
    return await fetchOnce(start, signal);
  } catch (error) {
    if (!(error instanceof SourceError && error.retryable)) throw error;
    await new Promise((resolve) => setTimeout(resolve, SERVER_ERROR_RETRY_MS));
    return fetchOnce(start, signal);
  }
}

async function fetchOnce(start: URL, signal: AbortSignal): Promise<Buffer> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "image/*" },
      redirect: "manual",
      signal,
    });
    if (response.status >= 300 && response.status < 400) {
      const next = allowedCoverUrl(new URL(response.headers.get("location") ?? "", url).href);
      if (!next) throw new SourceError("Cover redirected to a host that is not allowed.");
      url = next;
      continue;
    }
    if (response.status === 404 || response.status === 410) {
      throw new SourceError("Cover not found.", { notFound: true });
    }
    if (!response.ok) {
      throw new SourceError(`Cover host answered ${response.status}.`, {
        retryable: response.status >= 500,
      });
    }
    if (!(response.headers.get("content-type") ?? "").startsWith("image/")) {
      throw new SourceError("Cover is not an image.");
    }
    return readLimited(response);
  }
  throw new SourceError("Cover redirected too many times.");
}

/**
 * Makes a square WebP copy of a cover at the given width, cropped to fill like the wall's tiles,
 * and never enlarged.
 *
 * @param source Cover bytes in any format sharp reads.
 * @param width Output width and height in pixels.
 */
export function resizeCover(source: Buffer, width: number): Promise<Buffer> {
  return sharp(source, { limitInputPixels: MAX_SOURCE_PIXELS })
    .rotate()
    .resize(width, width, { fit: "cover", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}

/**
 * Makes the handler for `GET /img?url=<cover address>&w=<64|320|600>`: a resized copy of an
 * allowed cover that pages may read (CORS `*`), cached for a year by CloudFront and browsers.
 *
 * @param load Downloads a cover; tests pass their own.
 */
export const createHandler = (load: (url: URL) => Promise<Buffer>) =>
  async function handler(event: ImageEvent): Promise<ImageResponse> {
    const request = parseRequest(event);
    if (typeof request === "string") return respond(400, request, BAD_REQUEST_CACHE);

    let source: Buffer;
    try {
      source = await load(request.url);
    } catch (error) {
      if (error instanceof SourceError && error.notFound) {
        return respond(404, error.message, NOT_FOUND_CACHE);
      }
      const message = error instanceof Error ? error.message : String(error);
      console.error("Cover could not be fetched:", message);
      return respond(502, "Cover could not be fetched.", "no-store");
    }

    let image: Buffer;
    try {
      image = await resizeCover(source, request.width);
    } catch {
      // Not an image sharp can read: it will not become one, so this is cached like a bad request.
      return respond(422, "Cover could not be read as an image.", BAD_REQUEST_CACHE);
    }

    return {
      statusCode: 200,
      headers: {
        "content-type": "image/webp",
        "cache-control": IMAGE_CACHE,
        "access-control-allow-origin": "*",
        "cross-origin-resource-policy": "cross-origin",
        "x-content-type-options": "nosniff",
      },
      body: image.toString("base64"),
      isBase64Encoded: true,
    };
  };

export const handler = createHandler(fetchCover);
