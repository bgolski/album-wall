import { describe, expect, it } from "vitest";
import { buildPdf } from "./pdf";

const text = (bytes: Uint8Array) => new TextDecoder("latin1").decode(bytes);

describe("buildPdf", () => {
  const jpeg = (size: number) => new Uint8Array(size).fill(0xab);
  const pdf = buildPdf(
    [
      { jpeg: jpeg(40), width: 100, height: 150 },
      { jpeg: jpeg(25), width: 100, height: 150 },
    ],
    { width: 612, height: 792 }
  );
  const source = text(pdf);

  it("is a PDF with one page per picture, each as big as the page", () => {
    expect(source.startsWith("%PDF-1.4\n")).toBe(true);
    expect(source.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(source).toContain("/Count 2");
    expect(source.match(/\/Type \/Page /g)).toHaveLength(2);
    expect(source).toContain("/MediaBox [0 0 612.00 792.00]");
    expect(source).toContain("q 612.00 0 0 792.00 0 0 cm /Im0 Do Q");
  });

  it("embeds each JPEG untouched, with its size and length", () => {
    expect(source).toContain("/Width 100 /Height 150");
    expect(source).toContain("/Filter /DCTDecode /Length 40");
    expect(source).toContain("/Filter /DCTDecode /Length 25");
    expect(source.match(/«+/g)?.map((run) => run.length)).toEqual([40, 25]);
  });

  it("lists where every object starts, so a reader can find them", () => {
    const startxref = Number(source.match(/startxref\n(\d+)\n/)![1]);
    expect(source.slice(startxref, startxref + 4)).toBe("xref");
    const rows = source
      .slice(startxref)
      .split("\n")
      .filter((line) => /^\d{10} (00000 n|65535 f) $/.test(line));
    expect(rows).toHaveLength(9);
    rows.slice(1).forEach((row, index) => {
      const offset = Number(row.slice(0, 10));
      expect(source.slice(offset).startsWith(`${index + 1} 0 obj`)).toBe(true);
    });
  });
});
