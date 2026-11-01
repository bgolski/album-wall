import { describe, it, expect } from "vitest";
import {
  buildSharedWallState,
  encodeSharedWallState,
  decodeSharedWallState,
  getEncodedSharedWallStateFromHash,
  getSharedWallStateFromHash,
  buildSharedWallUrl,
  buildShareHash,
  orderAlbumsBySharedWall,
} from "@/share/shareState";

const toBase64Url = (s: string): string =>
  btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

const sampleState = buildSharedWallState({
  username: "testuser",
  rows: 3,
  columns: 4,
  wallAlbumIds: ["1", "2", "3"],
  pinnedAlbumIds: ["2"],
});

describe("shareState utilities", () => {
  it("round-trip encode → decode preserves state", () => {
    const decoded = decodeSharedWallState(encodeSharedWallState(sampleState));
    expect(decoded).toEqual(sampleState);
  });

  it("buildShareHash and extraction work with hash strings", () => {
    const encoded = encodeSharedWallState(sampleState);
    const hash = buildShareHash(encoded);
    expect(getEncodedSharedWallStateFromHash(hash)).toBe(encoded);
    expect(getSharedWallStateFromHash(hash)).toEqual(sampleState);
  });

  it("hash extraction handles missing or different key", () => {
    expect(getEncodedSharedWallStateFromHash("#foo=bar")).toBeNull();
    expect(getSharedWallStateFromHash("#foo=bar")).toBeNull();
    expect(getEncodedSharedWallStateFromHash("share=abc")).toBe("abc");
  });

  it("decodeSharedWallState rejects malformed payloads", () => {
    // Invalid base64url characters
    expect(decodeSharedWallState("!!!")).toBeNull();
    // Valid base64url but not valid JSON
    expect(decodeSharedWallState(toBase64Url("not-json"))).toBeNull();
    // Wrong version
    expect(
      decodeSharedWallState(
        toBase64Url(
          JSON.stringify({
            v: 2,
            username: "u",
            rows: 1,
            columns: 1,
            wallAlbumIds: ["a"],
            pinnedAlbumIds: ["b"],
          })
        )
      )
    ).toBeNull();
    // Missing pinnedAlbumIds
    expect(
      decodeSharedWallState(
        toBase64Url(
          JSON.stringify({ v: 1, username: "u", rows: 1, columns: 1, wallAlbumIds: ["a"] })
        )
      )
    ).toBeNull();
    // Wrong field types (username as number, rows as string)
    expect(
      decodeSharedWallState(
        toBase64Url(
          JSON.stringify({
            v: 1,
            username: 123,
            rows: "1",
            columns: 1,
            wallAlbumIds: ["a"],
            pinnedAlbumIds: ["b"],
          })
        )
      )
    ).toBeNull();
    // Non-array wallAlbumIds
    expect(
      decodeSharedWallState(
        toBase64Url(
          JSON.stringify({
            v: 1,
            username: "u",
            rows: 1,
            columns: 1,
            wallAlbumIds: "a",
            pinnedAlbumIds: ["b"],
          })
        )
      )
    ).toBeNull();
  });

  it("buildSharedWallUrl inserts hash into URL correctly", () => {
    const url = buildSharedWallUrl(sampleState, "https://example.com/album-wall?foo=bar");
    const parsed = new URL(url);
    expect(parsed.hash.startsWith("#share=")).toBe(true);
    expect(getSharedWallStateFromHash(parsed.hash)).toEqual(sampleState);
  });
});

describe("orderAlbumsBySharedWall", () => {
  const albums = [1, 2, 3, 4, 5].map((id) => ({ id, title: `T${id}`, artist: "A" }));
  const state = (wallAlbumIds: string[]) =>
    buildSharedWallState({ username: "u", rows: 1, columns: 3, wallAlbumIds, pinnedAlbumIds: [] });

  it("puts the shared wall first, in the shared order, then the rest in their own order", () => {
    expect(orderAlbumsBySharedWall(albums, state(["4", "2", "5"])).map((a) => a.id)).toEqual([
      4, 2, 5, 1, 3,
    ]);
  });

  it("skips shared albums that are not in the collection", () => {
    expect(orderAlbumsBySharedWall(albums, state(["99", "3", "1"])).map((a) => a.id)).toEqual([
      3, 1, 2, 4, 5,
    ]);
  });

  it("keeps the collection order when the shared wall is empty", () => {
    expect(orderAlbumsBySharedWall(albums, state([]))).toEqual(albums);
  });

  it("does not change the collection it was given", () => {
    const copy = [...albums];
    orderAlbumsBySharedWall(albums, state(["5"]));
    expect(albums).toEqual(copy);
  });
});

describe("compact share links", () => {
  // Discogs release ids for an 8 x 4 wall are mostly seven or eight digits long.
  const wallAlbumIds = Array.from({ length: 32 }, (_, index) =>
    String(1_234_567 + index * 987_653)
  );
  const wall = buildSharedWallState({
    username: "bgolski",
    rows: 4,
    columns: 8,
    wallAlbumIds,
    pinnedAlbumIds: [wallAlbumIds[3]!, wallAlbumIds[31]!],
  });
  const jsonPayload = toBase64Url(JSON.stringify(wall));

  it("round-trips a full wall with pins", () => {
    expect(decodeSharedWallState(encodeSharedWallState(wall))).toEqual(wall);
  });

  it("is less than half the length of the JSON link", () => {
    const compact = encodeSharedWallState(wall);
    expect(compact.length).toBeLessThan(jsonPayload.length * 0.5);
  });

  it("still opens links in the earlier JSON format", () => {
    expect(decodeSharedWallState(jsonPayload)).toEqual(wall);
  });

  it("keeps names in any language and ids up to the largest safe number", () => {
    const odd = buildSharedWallState({
      username: "Zoë & 日本",
      rows: 1,
      columns: 2,
      wallAlbumIds: ["0", String(Number.MAX_SAFE_INTEGER)],
      pinnedAlbumIds: [],
    });
    expect(decodeSharedWallState(encodeSharedWallState(odd))).toEqual(odd);
  });

  it("falls back to JSON for ids that are not whole numbers or pins off the wall", () => {
    const named = { ...wall, wallAlbumIds: ["a1", ...wallAlbumIds.slice(1)] };
    expect(encodeSharedWallState(named).startsWith("eyJ")).toBe(true);
    expect(decodeSharedWallState(encodeSharedWallState(named))).toEqual(named);
    const offWall = { ...wall, pinnedAlbumIds: ["42"] };
    expect(decodeSharedWallState(encodeSharedWallState(offWall))).toEqual(offWall);
  });

  it("rejects a cut-off or padded compact link", () => {
    const compact = encodeSharedWallState(wall);
    expect(decodeSharedWallState(compact.slice(0, -6))).toBeNull();
    expect(decodeSharedWallState(compact + "AAAA")).toBeNull();
  });
});
