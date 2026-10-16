import type { Album } from "@/types";
import { assignByCost } from "@/utils/assignByCost";

// The cost given to a record that is not in the chosen groups, so it only goes up when nothing
// chosen is left to fill the spot.
const OUTSIDER_COST = 1;

/**
 * Fills the wall with the records of chosen groups, in order from left to right: the first group
 * on the left, the last on the right. When the chosen groups hold more records than the wall has
 * spots, the wall gets an even share from along the whole run; when they hold fewer, they take the
 * start of the run and other records fill the rest. Pinned records stay.
 *
 * @param input.albums The whole collection in its current order; the first `rows * columns` are
 *                     the wall.
 * @param input.select Whether a record is in the chosen groups.
 * @param input.compare Orders the chosen records along the run.
 * @param input.firstOnly Use only the first records of the run (a sorted view of the collection),
 *                        placed row by row, rather than an even share of all of it.
 * @returns The collection in its new order (wall first, then the rest in their previous order),
 *          and how many wall spots went to chosen records and to other records.
 */
export function buildGroupWall(input: {
  albums: Album[];
  rows: number;
  columns: number;
  pinned: ReadonlySet<string>;
  select: (album: Album) => boolean;
  compare: (first: Album, second: Album) => number;
  firstOnly?: boolean;
}): { albums: Album[]; chosen: number; others: number } {
  const { albums, rows, columns, pinned } = input;
  const positions = Math.min(rows * columns, albums.length);
  if (positions === 0) return { albums, chosen: 0, others: 0 };

  const pinnedAt = Array.from({ length: positions }, (_, position) =>
    pinned.has(String(albums[position]!.id)) ? position : null
  );
  const pinnedCovers = new Set(pinnedAt.filter((cover): cover is number => cover !== null));
  const free = pinnedAt.filter((cover) => cover === null).length;

  const run = albums
    .map((_, cover) => cover)
    .filter((cover) => !pinned.has(String(albums[cover]!.id)) && input.select(albums[cover]!))
    .sort((a, b) => input.compare(albums[a]!, albums[b]!) || a - b);
  const used = input.firstOnly ? run.slice(0, free) : run;
  const spread = Math.max(used.length, free);
  const rank = new Map(used.map((cover, index) => [cover, (index + 0.5) / spread]));

  // How far along the run each spot lies. A sorted view reads row by row; otherwise the groups
  // run across the columns, and spots in one column go in reading order.
  const flow = (position: number) => {
    const column = position % columns;
    const row = Math.floor(position / columns);
    const across = columns > 1 ? column / (columns - 1) : 0;
    const reading = (position + 0.5) / positions;
    return input.firstOnly ? reading : across + 1e-3 * (reading - across) + 1e-6 * row;
  };
  const cost = (position: number, cover: number) => {
    const at = rank.get(cover);
    return at === undefined ? OUTSIDER_COST : Math.abs(at - flow(position));
  };

  const assigned = assignByCost({
    positions,
    candidates: albums.length,
    usable: (cover) => rank.has(cover),
    pinned: pinnedAt,
    cost,
  });

  const wall = assigned.filter((cover) => cover >= 0).map((cover) => albums[cover]!);
  const wallIds = new Set(wall.map((album) => album.id));
  const pool = albums.filter((album) => !wallIds.has(album.id));
  const chosen = assigned.filter((cover) => rank.has(cover)).length;
  const others = assigned.filter(
    (cover) => cover >= 0 && !rank.has(cover) && !pinnedCovers.has(cover)
  ).length;
  return { albums: [...wall, ...pool], chosen, others };
}
