import type { Album } from "@/types/index";
import { drawWall, type ImageLoader } from "./drawWall";
import { buildPdf } from "./pdf";
import { guideEntries, paginateEntries, type GuideEntry, type GuidePaper } from "./guideLayout";

// Everything below is in pixels of the page picture (150 to the inch).
const MARGIN = 90;
const LABEL_GUTTER = 56;
const LINE = 40;
const STEP_LINE = 52;
const GAP = 40;
const INK = "#1b1f2a";
const MUTED = "#6b7280";
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
// The wall takes at most this much of the page's height, so a tall wall leaves room for the list.
const WALL_SHARE = 0.6;
const MAX_CAPTURE_SIDE = 4096;

function canvasFor(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas drawing is not available");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.textBaseline = "alphabetic";
  return { canvas, context };
}

// Shortens text with an ellipsis until it fits the width.
function fit(context: CanvasRenderingContext2D, text: string, width: number) {
  if (context.measureText(text).width <= width) return text;
  let end = text.length;
  while (end > 1 && context.measureText(`${text.slice(0, end)}…`).width > width) end -= 1;
  return `${text.slice(0, end)}…`;
}

/**
 * Draws a list in two columns, down the first and then the second: where each record goes, then
 * what it is.
 */
function drawList(
  context: CanvasRenderingContext2D,
  entries: GuideEntry[],
  left: number,
  top: number,
  width: number,
  perColumn: number
) {
  const columnWidth = (width - GAP) / 2;
  context.font = `23px ${FONT}`;
  entries.forEach((entry, index) => {
    const column = Math.floor(index / perColumn);
    const x = left + column * (columnWidth + GAP);
    const y = top + (index % perColumn) * LINE + 28;
    context.fillStyle = MUTED;
    context.font = `600 21px ${FONT}`;
    context.fillText(`R${entry.row} C${entry.column}`, x, y);
    context.fillStyle = INK;
    context.font = `23px ${FONT}`;
    const text = entry.artist ? `${entry.title}, ${entry.artist}` : entry.title;
    context.fillText(fit(context, text, columnWidth - 105), x + 105, y);
  });
}

const jpegOf = (canvas: HTMLCanvasElement) =>
  new Promise<Uint8Array>((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) reject(new Error("Failed to make the page"));
        else resolve(new Uint8Array(await blob.arrayBuffer()));
      },
      "image/jpeg",
      0.9
    );
  });

/**
 * Makes the hanging guide: page one is the wall as a grid with its rows and columns numbered,
 * and the records are listed under it (on further pages when there are many), each with the row
 * and column it hangs in, so the wall can be hung at the wall without the screen.
 *
 * @param input.albums The albums on the wall, in order.
 * @param input.title Named at the top of the first page.
 * @param input.changes Steps to change the wall hung last time into this one, drawn on pages of
 *        their own with a box to tick for each.
 * @param input.placeholder Image drawn for a cover that cannot be included.
 * @param input.loadImage Image loader, for tests.
 * @returns The PDF and how many covers had to be left out.
 */
export async function makeGuide(input: {
  grid: HTMLElement;
  albums: Album[];
  rows: number;
  columns: number;
  title: string;
  paper: GuidePaper;
  placeholder: string;
  changes?: { since: string; lines: string[] };
  loadImage?: ImageLoader;
}): Promise<{ pdf: Blob; coversLeftOut: number }> {
  const { grid, albums, rows, columns, title, paper, placeholder, changes } = input;
  const { width: pageWidth, height: pageHeight } = paper.pixels;
  const gridWidth = grid.offsetWidth || 1;
  const gridHeight = grid.offsetHeight || 1;

  // The wall fills the page's width, but not more than its share of the height.
  const room = pageWidth - 2 * MARGIN - LABEL_GUTTER;
  const scale = Math.min(
    room / gridWidth,
    (pageHeight * WALL_SHARE) / gridHeight,
    MAX_CAPTURE_SIDE / Math.max(gridWidth, gridHeight)
  );
  const drawn = await drawWall({
    grid,
    albums,
    scale,
    background: "#ffffff",
    placeholder,
    ...(input.loadImage ? { loadImage: input.loadImage } : {}),
  });

  const entries = guideEntries(albums, columns);
  const wallLeft = MARGIN + LABEL_GUTTER + (room - drawn.canvas.width) / 2;
  const wallTop = MARGIN + 175;
  const listTop = wallTop + drawn.canvas.height + 60;
  const firstColumn = Math.max(0, Math.floor((pageHeight - MARGIN - listTop) / LINE));
  const otherColumn = Math.floor((pageHeight - 2 * MARGIN - 70) / LINE);
  const pages = paginateEntries(entries, firstColumn * 2, otherColumn * 2);
  const listWidth = pageWidth - 2 * MARGIN;

  const jpegs: Uint8Array[] = [];
  for (let index = 0; index < pages.length; index += 1) {
    const { canvas, context } = canvasFor(pageWidth, pageHeight);
    if (index === 0) {
      context.fillStyle = INK;
      context.font = `700 46px ${FONT}`;
      context.fillText(title, MARGIN, MARGIN + 46);
      context.fillStyle = MUTED;
      context.font = `26px ${FONT}`;
      context.fillText(`${columns} × ${rows} wall, ${entries.length} records`, MARGIN, MARGIN + 92);
      context.drawImage(drawn.canvas, wallLeft, wallTop);
      // Columns counted along the top, rows down the side.
      context.fillStyle = MUTED;
      context.font = `600 24px ${FONT}`;
      context.textAlign = "center";
      drawn.tiles.slice(0, columns).forEach((tile, column) => {
        context.fillText(String(column + 1), wallLeft + tile.x + tile.width / 2, wallTop - 16);
      });
      context.textAlign = "right";
      for (let row = 0; row < rows; row += 1) {
        const tile = drawn.tiles[row * columns];
        if (tile)
          context.fillText(String(row + 1), wallLeft - 16, wallTop + tile.y + tile.height / 2 + 8);
      }
      context.textAlign = "left";
      drawList(context, pages[0]!, MARGIN, listTop, listWidth, Math.max(1, firstColumn));
    } else {
      context.fillStyle = MUTED;
      context.font = `600 26px ${FONT}`;
      context.fillText(`${title}, continued`, MARGIN, MARGIN + 26);
      drawList(context, pages[index]!, MARGIN, MARGIN + 70, listWidth, Math.max(1, otherColumn));
    }
    jpegs.push(await jpegOf(canvas));
  }

  // The steps to change the wall hung last time into this one, a box to tick beside each.
  if (changes && changes.lines.length > 0) {
    const perPage = Math.floor((pageHeight - 2 * MARGIN - 110) / STEP_LINE);
    const stepPages = paginateEntries(changes.lines, perPage, perPage);
    let number = 0;
    for (let index = 0; index < stepPages.length; index += 1) {
      const { canvas, context } = canvasFor(pageWidth, pageHeight);
      context.fillStyle = INK;
      context.font = `700 40px ${FONT}`;
      context.fillText(index === 0 ? "Changes" : "Changes, continued", MARGIN, MARGIN + 40);
      context.fillStyle = MUTED;
      context.font = `26px ${FONT}`;
      context.fillText(`Since ${changes.since}`, MARGIN, MARGIN + 82);
      stepPages[index]!.forEach((line, at) => {
        number += 1;
        const y = MARGIN + 150 + at * STEP_LINE;
        context.strokeStyle = MUTED;
        context.lineWidth = 3;
        context.strokeRect(MARGIN, y - 24, 28, 28);
        context.fillStyle = MUTED;
        context.font = `600 22px ${FONT}`;
        context.fillText(String(number), MARGIN + 50, y);
        context.fillStyle = INK;
        context.font = `25px ${FONT}`;
        context.fillText(fit(context, line, pageWidth - 2 * MARGIN - 120), MARGIN + 110, y);
      });
      jpegs.push(await jpegOf(canvas));
    }
  }

  const bytes = buildPdf(
    jpegs.map((jpeg) => ({ jpeg, width: pageWidth, height: pageHeight })),
    paper.points
  );
  return {
    pdf: new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" }),
    coversLeftOut: drawn.left,
  };
}
