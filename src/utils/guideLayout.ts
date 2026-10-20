import type { Album } from "@/types";

/** One line of the guide: where a record goes, and which one. */
export interface GuideEntry {
  /** Row and column on the wall, counted from 1. */
  row: number;
  column: number;
  title: string;
  artist: string;
}

/**
 * The records on the wall as the guide lists them: row by row, left to right.
 *
 * @param albums The wall's albums, in order.
 * @param columns How many columns the wall has.
 * @returns One entry for each album.
 */
export function guideEntries(albums: Album[], columns: number): GuideEntry[] {
  return albums.map((album, index) => ({
    row: Math.floor(index / columns) + 1,
    column: (index % columns) + 1,
    title: album.title || "Untitled",
    artist: album.artist || "",
  }));
}

/**
 * Splits the entries across pages: the first page has room for fewer, as the wall takes its top.
 *
 * @param entries Every entry, in order.
 * @param firstPage How many fit on the first page (it may be none).
 * @param otherPages How many fit on each of the others.
 * @returns The entries of each page.
 */
export function paginateEntries<T>(entries: T[], firstPage: number, otherPages: number): T[][] {
  const pages: T[][] = [entries.slice(0, Math.max(0, firstPage))];
  let at = pages[0]!.length;
  while (at < entries.length) {
    pages.push(entries.slice(at, at + Math.max(1, otherPages)));
    at += Math.max(1, otherPages);
  }
  return pages;
}

/** A page size and its pixels at 150 to the inch. */
export interface GuidePaper {
  /** Points, 72 to the inch, for the PDF. */
  points: { width: number; height: number };
  /** Pixels the pictures are drawn at. */
  pixels: { width: number; height: number };
}

const LETTER: GuidePaper = {
  points: { width: 612, height: 792 },
  pixels: { width: 1275, height: 1650 },
};
const A4: GuidePaper = {
  points: { width: 595.28, height: 841.89 },
  pixels: { width: 1240, height: 1754 },
};

// Where Letter is the usual paper; everywhere else uses A4.
const LETTER_REGIONS = new Set(["US", "CA", "MX", "PH", "CL", "CO", "VE", "CR", "GT"]);

/**
 * The paper to make the guide for, from the visitor's language setting.
 *
 * @param locale A language tag such as "en-US".
 * @returns Letter in the countries that use it, A4 otherwise.
 */
export function paperFor(locale: string | undefined): GuidePaper {
  try {
    const region = locale ? new Intl.Locale(locale).maximize().region : undefined;
    return region && LETTER_REGIONS.has(region) ? LETTER : A4;
  } catch {
    return A4;
  }
}
