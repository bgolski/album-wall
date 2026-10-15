import { readFileSync, writeFileSync } from "node:fs";

// Adds Discogs styles to the demo collection, so arranging by style works without a Discogs
// account. Each demo cover comes from a MusicBrainz release group; MusicBrainz links most of them
// to a Discogs master release, whose styles are copied. Albums without a link keep no styles,
// and years already in the file are kept. Run again after the demo list changes:
//   npx vite-node scripts/add-demo-styles.ts && npx prettier --write public/demo/collection.json
// It needs network access and takes a few minutes (both services limit request rates).
const file = "public/demo/collection.json";
const USER_AGENT = "AlbumWall/1.0 +https://github.com/bgolski/album-wall";
const MUSICBRAINZ_DELAY_MS = 1100;
// Discogs allows 25 requests a minute without a token.
const DISCOGS_DELAY_MS = 2500;

interface DemoAlbum {
  id: number;
  title: string;
  artist: string;
  year?: string;
  styles?: string[];
  cover_image?: string;
  profile?: unknown;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJson<T>(url: string): Promise<T | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (response.ok) return (await response.json()) as T;
    if (response.status !== 429 && response.status < 500) return null;
    await wait(30_000);
  }
  return null;
}

async function discogsMasterId(releaseGroupId: string): Promise<string | null> {
  const group = await getJson<{ relations?: { type: string; url?: { resource: string } }[] }>(
    `https://musicbrainz.org/ws/2/release-group/${releaseGroupId}?inc=url-rels&fmt=json`
  );
  await wait(MUSICBRAINZ_DELAY_MS);
  const link = group?.relations?.find((relation) => relation.type === "discogs")?.url?.resource;
  return link?.match(/discogs\.com\/master\/(\d+)/)?.[1] ?? null;
}

// Styles go right after the year, so each album reads in the same order.
function withStyles(album: DemoAlbum, styles: string[] | undefined): DemoAlbum {
  const entries = Object.entries(album).filter(([key]) => key !== "styles");
  const at = entries.findIndex(([key]) => key === "year") + 1 || entries.length;
  if (styles) entries.splice(at, 0, ["styles", styles]);
  return Object.fromEntries(entries) as unknown as DemoAlbum;
}

const collection = JSON.parse(readFileSync(file, "utf8")) as { v: number; albums: DemoAlbum[] };
const missing: string[] = [];
for (const [index, album] of collection.albums.entries()) {
  const releaseGroupId = album.cover_image?.match(/release-group\/([0-9a-f-]{36})/)?.[1];
  const masterId = releaseGroupId ? await discogsMasterId(releaseGroupId) : null;
  const master = masterId
    ? await getJson<{ styles?: string[]; year?: number }>(
        `https://api.discogs.com/masters/${masterId}`
      )
    : null;
  if (masterId) await wait(DISCOGS_DELAY_MS);
  if (master?.year && album.year !== String(master.year)) {
    console.warn(`${album.artist} - ${album.title}: year ${album.year}, Discogs ${master.year}`);
  }
  if (!master?.styles?.length) missing.push(`${album.artist} - ${album.title}`);
  collection.albums[index] = withStyles(album, master?.styles?.length ? master.styles : undefined);
}

// Keep each packed profile on one line, as compute-demo-colors.ts writes them.
const packed = new Map<string, string>();
collection.albums.forEach((album, index) => {
  if (!album.profile) return;
  const marker = `__profile_${index}__`;
  packed.set(`"${marker}"`, JSON.stringify(album.profile));
  album.profile = marker;
});
let text = JSON.stringify(collection, null, 2);
for (const [marker, value] of packed) text = text.replace(marker, value);
writeFileSync(file, text + "\n");
console.log(
  `Styles for ${collection.albums.length - missing.length} of ${collection.albums.length}.`
);
if (missing.length) console.log(`No Discogs styles: ${missing.join("; ")}`);
