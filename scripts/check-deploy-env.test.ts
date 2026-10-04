// @vitest-environment node
import { describe, expect, it } from "vitest";
import { findEnvProblems } from "./check-deploy-env";

const good = {
  NEXT_PUBLIC_DISCOGS_PROXY_URL: "https://abc.lambda-url.us-east-1.on.aws/",
  NEXT_PUBLIC_BASE_PATH: "/album-wall",
};

describe("findEnvProblems", () => {
  it("accepts complete settings", () => {
    expect(findEnvProblems(good)).toEqual([]);
  });

  it("names each missing variable", () => {
    expect(findEnvProblems({})).toEqual([
      "NEXT_PUBLIC_DISCOGS_PROXY_URL is not set.",
      "NEXT_PUBLIC_BASE_PATH is not set.",
    ]);
  });

  it("treats blank values as missing", () => {
    expect(findEnvProblems({ ...good, NEXT_PUBLIC_DISCOGS_PROXY_URL: "  " })).toEqual([
      "NEXT_PUBLIC_DISCOGS_PROXY_URL is not set.",
    ]);
  });

  it("requires an https proxy URL", () => {
    expect(findEnvProblems({ ...good, NEXT_PUBLIC_DISCOGS_PROXY_URL: "http://x.test/" })).toEqual([
      "NEXT_PUBLIC_DISCOGS_PROXY_URL must be an https:// URL.",
    ]);
    expect(findEnvProblems({ ...good, NEXT_PUBLIC_DISCOGS_PROXY_URL: "not a url" })).toEqual([
      "NEXT_PUBLIC_DISCOGS_PROXY_URL is not a valid URL.",
    ]);
  });

  it("requires a base path that starts but does not end with a slash", () => {
    for (const basePath of ["album-wall", "/album-wall/"]) {
      expect(findEnvProblems({ ...good, NEXT_PUBLIC_BASE_PATH: basePath })).toHaveLength(1);
    }
  });
});
