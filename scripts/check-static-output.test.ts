// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findOutputProblems } from "./check-static-output";

const goodHtml =
  '<link rel="stylesheet" href="/album-wall/_next/static/css/a.css"/>' +
  '<script src="/album-wall/_next/static/chunks/b.js"></script><a href="/album-wall/">home</a>';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "static-output-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function build(html: string, with404 = true) {
  writeFileSync(join(dir, "index.html"), html);
  if (with404) writeFileSync(join(dir, "404.html"), "not found");
}

describe("findOutputProblems", () => {
  it("accepts a build served under its base path", () => {
    build(goodHtml);
    expect(findOutputProblems(dir, "/album-wall")).toEqual([]);
  });

  it("reports a missing 404 page", () => {
    build(goodHtml, false);
    expect(findOutputProblems(dir, "/album-wall")).toEqual(["404.html is missing from the build."]);
  });

  it("reports a missing home page", () => {
    writeFileSync(join(dir, "404.html"), "x");
    expect(findOutputProblems(dir, "/album-wall")).toEqual([
      "index.html is missing from the build.",
    ]);
  });

  it("reports assets built for the wrong base path", () => {
    build('<script src="/_next/static/chunks/b.js"></script>');
    const problems = findOutputProblems(dir, "/album-wall");
    expect(problems).toContain(
      "index.html points at /_next/static/chunks/b.js, outside the base path /album-wall."
    );
    expect(problems).toContain("index.html has no assets under /album-wall/_next/.");
  });

  it("does not take a longer path that merely starts with the base path", () => {
    build(goodHtml + '<a href="/album-wall-old/x">old</a>');
    expect(findOutputProblems(dir, "/album-wall")).toEqual([
      "index.html points at /album-wall-old/x, outside the base path /album-wall.",
    ]);
  });

  it("ignores external and protocol-relative links", () => {
    build(goodHtml + '<a href="https://example.com/x">x</a><a href="//cdn.test/y.js">y</a>');
    expect(findOutputProblems(dir, "/album-wall")).toEqual([]);
  });

  it("only checks the files when there is no base path", () => {
    build('<script src="/_next/static/chunks/b.js"></script>');
    expect(findOutputProblems(dir, "")).toEqual([]);
  });
});
