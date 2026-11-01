import { afterEach, describe, expect, it, vi } from "vitest";
import { savedWallsClient } from "./savedWalls";
import { unionLayouts, MAX_LAYOUTS, type SavedLayout } from "@/wall/layoutStore";

const session = { username: "bgolski", token: "tok", secret: "sec" };

afterEach(() => vi.restoreAllMocks());

describe("savedWallsClient", () => {
  it("reads both kinds with the sign-in, once for layouts and history together", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        Response.json({ layouts: { data: "[]", updatedAt: "t1" }, history: null })
      );
    const client = savedWallsClient(session, "https://example.test/discogs-proxy/")!;
    const [first, second] = await Promise.all([client.load("Bgolski"), client.load("bgolski")]);
    expect(first).toEqual({ layouts: { data: "[]", updatedAt: "t1" }, history: null });
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://example.test/discogs-proxy/saved?collection=bgolski");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tok:sec");
  });

  it("saves one kind and removes everything", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ updatedAt: "t2" }))
      .mockResolvedValueOnce(Response.json({ deleted: 3 }));
    const client = savedWallsClient(session, "https://example.test/")!;
    expect(await client.save("Bgolski", "history", "[]")).toBe("t2");
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]?.body))).toEqual({
      collection: "bgolski",
      kind: "history",
      data: "[]",
    });
    expect(await client.removeAll()).toBe(3);
    expect(String(fetchMock.mock.calls[1]![0])).toBe("https://example.test/saved/delete");
  });

  it("fails loudly on an error answer and is unavailable without a proxy", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 503 }));
    await expect(savedWallsClient(session, "https://example.test/")!.load("a")).rejects.toThrow();
    expect(savedWallsClient(session, "")).toBeNull();
  });
});

describe("unionLayouts", () => {
  const wall = {
    v: 1 as const,
    username: "a",
    rows: 1,
    columns: 1,
    wallAlbumIds: [],
    pinnedAlbumIds: [],
  };
  const layout = (id: string, savedAt: string, name = id): SavedLayout => ({
    v: 1,
    id,
    name,
    savedAt,
    wall,
  });

  it("keeps one of each id, the more recently saved, this browser's first", () => {
    const combined = unionLayouts(
      [layout("a", "2026-10-01", "old a"), layout("b", "2026-10-01")],
      [layout("a", "2026-10-05", "new a"), layout("c", "2026-10-02")]
    );
    expect(combined.map((l) => [l.id, l.name])).toEqual([
      ["a", "new a"],
      ["b", "b"],
      ["c", "c"],
    ]);
  });

  it("keeps at most the limit, dropping the oldest", () => {
    const many = Array.from({ length: MAX_LAYOUTS }, (_, n) =>
      layout(`l${n}`, `2026-10-${String(n + 1).padStart(2, "0")}`)
    );
    const combined = unionLayouts(many, [layout("newest", "2026-12-01")]);
    expect(combined).toHaveLength(MAX_LAYOUTS);
    expect(combined.some((l) => l.id === "l0")).toBe(false);
    expect(combined.some((l) => l.id === "newest")).toBe(true);
  });
});
