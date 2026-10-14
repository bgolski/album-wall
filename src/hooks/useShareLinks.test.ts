import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSharedWallState } from "@/utils/shareState";
import { useShareLinks } from "./useShareLinks";

const requestShortLink = vi.fn();
vi.mock("@/utils/shortLink", () => ({
  requestShortLink: (...args: unknown[]) => requestShortLink(...args),
}));
const copyLink = vi.fn();
vi.mock("@/utils/copyText", () => ({ copyLink: (link: string) => copyLink(link) }));

const SHORT = "https://d111.cloudfront.net/w/AbCd1234";
const wall = buildSharedWallState({
  username: "someone",
  rows: 1,
  columns: 2,
  wallAlbumIds: ["11", "22"],
  pinnedAlbumIds: [],
});

function setup() {
  const setStatus = vi.fn();
  const { result } = renderHook(() =>
    useShareLinks({
      username: "someone",
      wall,
      covers: ["https://i.discogs.com/a.jpg", "https://i.discogs.com/b.jpg"],
      closeMenu: vi.fn(),
      setStatus,
    })
  );
  return { result, setStatus };
}

beforeEach(() => {
  requestShortLink.mockReset();
  copyLink.mockReset().mockResolvedValue("copied");
});

afterEach(() => {
  Reflect.deleteProperty(navigator, "share");
});

describe("useShareLinks", () => {
  it("asks for the short link once per wall, with the wall's covers and title", async () => {
    requestShortLink.mockResolvedValue(SHORT);
    const { result } = setup();
    await act(async () => {
      result.current.prepare();
      result.current.prepare();
    });
    expect(requestShortLink).toHaveBeenCalledTimes(1);
    expect(requestShortLink.mock.calls[0]![0]).toMatchObject({
      title: "someone's Album Wall",
      rows: 1,
      columns: 2,
      covers: ["https://i.discogs.com/a.jpg", "https://i.discogs.com/b.jpg"],
      app: `${window.location.origin}${window.location.pathname}`,
    });
  });

  it("copies the short link once it is ready", async () => {
    requestShortLink.mockResolvedValue(SHORT);
    const { result, setStatus } = setup();
    await act(async () => result.current.prepare());
    await act(async () => result.current.copyShareLink());
    expect(copyLink).toHaveBeenCalledWith(SHORT);
    expect(setStatus).toHaveBeenLastCalledWith({ message: "Share link copied.", tone: "info" });
  });

  it("waits for a short link under way, and copies the long link when none comes", async () => {
    requestShortLink.mockResolvedValue(null);
    const { result } = setup();
    await act(async () => result.current.copyShareLink());
    expect(copyLink.mock.calls[0]![0]).toContain("#share=");
  });

  it("asks again after a failed attempt", async () => {
    requestShortLink.mockResolvedValueOnce(null).mockResolvedValueOnce(SHORT);
    const { result } = setup();
    await act(async () => result.current.prepare());
    await act(async () => result.current.copyShareLink());
    expect(copyLink).toHaveBeenCalledWith(SHORT);
  });

  it("offers a Share link button when Safari refuses the share after waiting", async () => {
    let finish: (url: string) => void = () => {};
    requestShortLink.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const share = vi.fn().mockRejectedValue(new DOMException("", "NotAllowedError"));
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    const { result, setStatus } = setup();
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.shareLink();
    });
    await act(async () => {
      finish(SHORT);
      await pending;
    });
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: SHORT }));
    const status = setStatus.mock.calls.at(-1)![0];
    expect(status.action.label).toBe("Share link");
    share.mockResolvedValue(undefined);
    status.action.run();
    expect(share).toHaveBeenCalledTimes(2);
  });
});
