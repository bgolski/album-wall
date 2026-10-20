/** One page: a JPEG that fills it. */
export interface PdfPage {
  /** The picture, as the bytes of a JPEG file. */
  jpeg: Uint8Array;
  /** The picture's size in pixels. */
  width: number;
  height: number;
}

/**
 * Builds a PDF file from pictures, one per page, each filling its page. Small enough to need no
 * library: a PDF is a list of numbered objects followed by a table of where each one starts.
 *
 * @param pages The pages, in order.
 * @param size The page size in points (72 to the inch).
 * @returns The bytes of the PDF.
 */
export function buildPdf(pages: PdfPage[], size: { width: number; height: number }): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let length = 0;
  const push = (data: Uint8Array | string) => {
    const bytes = typeof data === "string" ? encoder.encode(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  };
  // Where each numbered object starts; object 0 is the empty head of the table.
  const starts: number[] = [];
  const start = (id: number) => {
    starts[id] = length;
  };
  const points = (value: number) => value.toFixed(2);

  // Objects: 1 is the catalog, 2 the list of pages, then three for each page.
  const pageId = (index: number) => 3 + index * 3;
  push("%PDF-1.4\n");

  start(1);
  push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  start(2);
  const kids = pages.map((_, index) => `${pageId(index)} 0 R`).join(" ");
  push(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`);

  pages.forEach((page, index) => {
    const id = pageId(index);
    start(id);
    push(
      `${id} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${points(size.width)} ${points(size.height)}] ` +
        `/Resources << /XObject << /Im0 ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>\nendobj\n`
    );

    start(id + 1);
    const content = `q ${points(size.width)} 0 0 ${points(size.height)} 0 0 cm /Im0 Do Q`;
    push(
      `${id + 1} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`
    );

    start(id + 2);
    push(
      `${id + 2} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`
    );
    push(page.jpeg);
    push("\nendstream\nendobj\n");
  });

  const count = 3 + pages.length * 3;
  const tableAt = length;
  const row = (offset: number, inUse: boolean) =>
    `${String(offset).padStart(10, "0")} ${inUse ? "00000 n" : "65535 f"} \n`;
  push(`xref\n0 ${count}\n${row(0, false)}`);
  for (let id = 1; id < count; id += 1) push(row(starts[id] ?? 0, true));
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${tableAt}\n%%EOF\n`);

  const bytes = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  return bytes;
}
