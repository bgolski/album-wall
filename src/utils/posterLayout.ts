/** The poster sizes the service makes, in inches. */
export type PosterSize = "18x24" | "24x36";

/** The pixels of a poster at 300 to the inch: the short and the long side. */
export const POSTER_PIXELS: Record<PosterSize, { short: number; long: number }> = {
  "18x24": { short: 5400, long: 7200 },
  "24x36": { short: 7200, long: 10800 },
};

/** The gap between covers and their rounded corners, as shares of a cover; the margin, as a share of the short side. */
const POSTER_GAP = 0.12;
export const POSTER_RADIUS = 0.07;
const POSTER_MARGIN = 0.05;

/**
 * The shape of the poster for a wall: sideways when the wall is wider than it is tall.
 *
 * @param size Poster size.
 * @param rows The wall's rows.
 * @param columns The wall's columns.
 * @returns Width and height in pixels.
 */
export function posterFrame(size: PosterSize, rows: number, columns: number) {
  const { short, long } = POSTER_PIXELS[size];
  return columns / rows > 1.2 ? { width: long, height: short } : { width: short, height: long };
}

/**
 * Where everything goes on the poster: the wall fills what is left inside a 5% margin, centred,
 * with square covers. The poster service and the preview in the app both use this, so the preview
 * is the poster in miniature.
 *
 * @param size Poster size.
 * @param rows The wall's rows.
 * @param columns The wall's columns.
 * @returns The poster's size and the wall's place on it, in pixels.
 */
export function posterLayout(size: PosterSize, rows: number, columns: number) {
  const { width, height } = posterFrame(size, rows, columns);
  const margin = Math.round(Math.min(width, height) * POSTER_MARGIN);
  // A wall is `columns` covers and `columns - 1` gaps wide, and `rows` covers and gaps tall.
  const unitsWide = columns + (columns - 1) * POSTER_GAP;
  const unitsTall = rows + (rows - 1) * POSTER_GAP;
  const tile = Math.floor(
    Math.min((width - 2 * margin) / unitsWide, (height - 2 * margin) / unitsTall)
  );
  const gap = Math.round(tile * POSTER_GAP);
  const wallWidth = columns * tile + (columns - 1) * gap;
  const wallHeight = rows * tile + (rows - 1) * gap;
  return {
    width,
    height,
    tile,
    gap,
    left: Math.round((width - wallWidth) / 2),
    top: Math.round((height - wallHeight) / 2),
  };
}
