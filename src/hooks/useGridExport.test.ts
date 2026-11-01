import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useGridExport } from "./useGridExport";
import { useToast } from "./useToast";
import type { Album } from "@/types";
import { drawWall } from "@/utils/drawWall";
import { makeGuide } from "@/utils/guide";
import { drawRecordBackground } from "@/utils/recordBackground";
import { PosterError, requestPoster } from "@/utils/posterService";

// The export hook reports through the page's toast; read the two together.
function useExportWithToast(username: string, albums: Album[]) {
  const { toast, show } = useToast();
  return { ...useGridExport(username, albums, show), status: toast };
}

vi.mock("@/utils/drawWall", () => ({
  drawWall: vi.fn(),
}));
vi.mock("@/utils/guide", () => ({
  makeGuide: vi.fn(),
}));
vi.mock("@/utils/recordBackground", () => ({
  drawRecordBackground: vi.fn(),
}));
vi.mock("@/utils/posterService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/posterService")>()),
  requestPoster: vi.fn(),
}));

const wallMock = vi.mocked(drawWall);
const resolveCanvas = (canvas: unknown, left = 0) =>
  wallMock.mockResolvedValue({ canvas: canvas as HTMLCanvasElement, left, tiles: [] });

const mockCanvasToBlob = (blob: Blob) => {
  return { toBlob: (_cb: (b: Blob | null) => void) => _cb(blob) };
};

// Helper to create a grid element with labels
const createGridWithLabels = (count = 3): HTMLDivElement => {
  const grid = document.createElement("div");
  for (let i = 0; i < count; i++) {
    const label = document.createElement("div");
    label.className = "album-labels";
    label.style.display = "flex";
    grid.appendChild(label);
  }
  return grid;
};

// Setup global stubs
let originalAlert: typeof alert;
let originalURL: typeof URL;
let originalNavigator: typeof navigator;

beforeEach(() => {
  originalAlert = window.alert;
  window.alert = vi.fn();

  originalURL = window.URL;
  const urlMock = {
    createObjectURL: vi.fn().mockReturnValue("blob:url"),
    revokeObjectURL: vi.fn(),
  } as unknown as URL;
  Object.defineProperty(window, "URL", { value: urlMock, configurable: true });

  originalNavigator = window.navigator;
  Object.defineProperty(window, "navigator", {
    value: {
      share: vi.fn(),
      canShare: vi.fn().mockReturnValue(false),
    },
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  window.alert = originalAlert;
  Object.defineProperty(window, "URL", { value: originalURL, configurable: true });
  Object.defineProperty(window, "navigator", { value: originalNavigator, configurable: true });
  document.body.innerHTML = "";
});

describe("useGridExport", () => {
  const username = "testuser";
  const albums = [{ id: 1, title: "Album 1", artist: "Artist 1", imageUrl: "" }];

  it("reports in the status line when there is no grid or there are no albums", async () => {
    const { result } = renderHook(() => useExportWithToast(username, []));
    await act(async () => {
      await result.current.shareOrSaveImage();
    });
    expect(window.alert).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({ message: "No albums", tone: "error" });
  });

  it("reports in the status line when grid is missing even with albums", async () => {
    const { result } = renderHook(() => useExportWithToast(username, albums));
    // gridRef.current stays null
    await act(async () => {
      await result.current.shareOrSaveImage();
    });
    expect(window.alert).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({ message: "No albums", tone: "error" });
    expect(result.current.isExporting).toBe(false);
  });

  it("reports in the status line when albums are empty even with a grid present", async () => {
    const grid = createGridWithLabels();
    const { result } = renderHook(() => useExportWithToast(username, []));
    act(() => {
      result.current.gridRef.current = grid;
    });
    await act(async () => {
      await result.current.shareOrSaveImage();
    });
    expect(window.alert).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({ message: "No albums", tone: "error" });
    expect(result.current.isExporting).toBe(false);
  });

  it("downloads when share is not available", async () => {
    const grid = createGridWithLabels();
    const { result } = renderHook(() => useExportWithToast(username, albums));
    act(() => {
      result.current.gridRef.current = grid;
    });
    const blob = new Blob(["png"], { type: "image/png" });
    resolveCanvas(mockCanvasToBlob(blob));
    vi.spyOn(window.navigator, "canShare").mockReturnValue(false);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click");

    await act(async () => {
      await result.current.shareOrSaveImage();
    });

    expect(clickSpy).toHaveBeenCalled();
    expect(result.current.status?.message).toBe("Saved");
  });

  it("says how many covers could not be included", async () => {
    const grid = createGridWithLabels();
    const { result } = renderHook(() => useExportWithToast(username, albums));
    act(() => {
      result.current.gridRef.current = grid;
    });
    resolveCanvas(mockCanvasToBlob(new Blob(["png"], { type: "image/png" })), 3);
    vi.spyOn(window.navigator, "canShare").mockReturnValue(false);

    await act(async () => {
      await result.current.shareOrSaveImage();
    });

    expect(result.current.status?.message).toBe("Saved, 3 left out");
    expect(wallMock.mock.calls.at(-1)![0].albums).toBe(albums);
  });

  it("passes correct filename to downloadBlob", async () => {
    const grid = createGridWithLabels();
    const { result } = renderHook(() => useExportWithToast("testuser", albums));
    act(() => {
      result.current.gridRef.current = grid;
    });
    const blob = new Blob(["png"], { type: "image/png" });
    resolveCanvas(mockCanvasToBlob(blob));
    vi.spyOn(window.navigator, "canShare").mockReturnValue(false);
    const createSpy = vi.spyOn(document, "createElement");

    await act(async () => {
      await result.current.shareOrSaveImage();
    });

    const anchorEl = createSpy.mock.results[0]!.value as HTMLAnchorElement;
    expect(anchorEl.tagName).toBe("A");
    expect(anchorEl.getAttribute("download")).toBe("testuser_album_wall.png");
  });

  it("uses native share when supported", async () => {
    const grid = createGridWithLabels();
    const { result } = renderHook(() => useExportWithToast(username, albums));
    act(() => {
      result.current.gridRef.current = grid;
    });
    const blob = new Blob(["png"], { type: "image/png" });
    resolveCanvas(mockCanvasToBlob(blob));
    const shareSpy = vi.spyOn(window.navigator, "share").mockResolvedValue();
    vi.spyOn(window.navigator, "canShare").mockReturnValue(true);

    await act(async () => {
      await result.current.shareOrSaveImage();
    });

    expect(shareSpy).toHaveBeenCalled();
    expect(result.current.status).toBeNull();
  });

  it("offers a Share image button when Safari refuses the share after the capture", async () => {
    const grid = createGridWithLabels();
    const { result } = renderHook(() => useExportWithToast(username, albums));
    act(() => {
      result.current.gridRef.current = grid;
    });
    const blob = new Blob(["png"], { type: "image/png" });
    resolveCanvas(mockCanvasToBlob(blob));
    const shareSpy = vi
      .spyOn(window.navigator, "share")
      .mockRejectedValueOnce(new DOMException("needs a tap", "NotAllowedError"))
      .mockResolvedValue();
    vi.spyOn(window.navigator, "canShare").mockReturnValue(true);

    await act(async () => {
      await result.current.shareOrSaveImage();
    });

    expect(result.current.status?.message).toBe("Ready");
    expect(result.current.status?.tone).toBe("info");
    expect(shareSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.status?.action?.run();
    });

    expect(shareSpy).toHaveBeenCalledTimes(2);
    const [shared] = shareSpy.mock.calls[1] as unknown as [{ files: File[] }];
    expect(shared.files[0]!.name).toBe("testuser_album_wall.png");
  });

  it("names the demo wall's image Demo_album_wall.png, not after its reserved username", async () => {
    const grid = createGridWithLabels();
    const { result } = renderHook(() => useExportWithToast("~demo", albums));
    act(() => {
      result.current.gridRef.current = grid;
    });
    const blob = new Blob(["png"], { type: "image/png" });
    resolveCanvas(mockCanvasToBlob(blob));
    vi.spyOn(window.navigator, "canShare").mockReturnValue(false);
    const createSpy = vi.spyOn(document, "createElement");

    await act(async () => {
      await result.current.shareOrSaveImage();
    });

    const anchorEl = createSpy.mock.results[0]!.value as HTMLAnchorElement;
    expect(anchorEl.getAttribute("download")).toBe("Demo_album_wall.png");
  });

  it("uses Anonymous_album_wall.png filename when username is empty", async () => {
    const grid = createGridWithLabels();
    const { result } = renderHook(() => useExportWithToast("", albums));
    act(() => {
      result.current.gridRef.current = grid;
    });
    const blob = new Blob(["png"], { type: "image/png" });
    resolveCanvas(mockCanvasToBlob(blob));
    vi.spyOn(window.navigator, "canShare").mockReturnValue(false);
    const createSpy = vi.spyOn(document, "createElement");

    await act(async () => {
      await result.current.shareOrSaveImage();
    });

    const anchorEl = createSpy.mock.results[0]!.value as HTMLAnchorElement;
    expect(anchorEl.tagName).toBe("A");
    expect(anchorEl.getAttribute("download")).toBe("Anonymous_album_wall.png");
  });

  it("handles AbortError from share as cancelation", async () => {
    const grid = createGridWithLabels();
    const { result } = renderHook(() => useExportWithToast(username, albums));
    act(() => {
      result.current.gridRef.current = grid;
    });
    const blob = new Blob(["png"], { type: "image/png" });
    resolveCanvas(mockCanvasToBlob(blob));
    const abortErr = new DOMException("", "AbortError");
    vi.spyOn(window.navigator, "share").mockRejectedValue(abortErr);
    vi.spyOn(window.navigator, "canShare").mockReturnValue(true);

    await act(async () => {
      await result.current.shareOrSaveImage();
    });

    expect(result.current.status?.message).toBe("Canceled");
    expect(window.alert).not.toHaveBeenCalled();
  });

  it("handles generic export errors in the status line", async () => {
    const grid = createGridWithLabels();
    const { result } = renderHook(() => useExportWithToast(username, albums));
    act(() => {
      result.current.gridRef.current = grid;
    });
    const error = new Error("boom");
    wallMock.mockRejectedValue(error);

    await act(async () => {
      await result.current.shareOrSaveImage();
    });

    expect(window.alert).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({
      message: "Could not save the image",
      tone: "error",
    });
  });

  it("clears the status after a few seconds", async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useExportWithToast(username, []));
      await act(async () => {
        await result.current.shareOrSaveImage();
      });
      expect(result.current.status).not.toBeNull();
      act(() => {
        vi.advanceTimersByTime(6000);
      });
      expect(result.current.status).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("useGridExport sized images", () => {
  it("draws the wall centred on a canvas of the preset size and names the file after it", async () => {
    const grid = createGridWithLabels();
    const { result } = renderHook(() =>
      useExportWithToast("testuser", [{ id: 1, title: "A", artist: "B" }])
    );
    act(() => {
      result.current.gridRef.current = grid;
    });
    const captured = { width: 800, height: 600 };
    resolveCanvas(captured);
    const context = { fillStyle: "", fillRect: vi.fn(), drawImage: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      context as unknown as CanvasRenderingContext2D
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback: BlobCallback) =>
      callback(new Blob(["png"], { type: "image/png" }))
    );
    vi.spyOn(window.navigator, "canShare").mockReturnValue(false);
    const createSpy = vi.spyOn(document, "createElement");

    await act(async () => {
      await result.current.shareOrSaveImage({
        id: "desktop",
        label: "Desktop",
        width: 3000,
        height: 3000,
      });
    });

    const frame = createSpy.mock.results
      .map((entry) => entry.value as HTMLElement)
      .find((element) => element.tagName === "CANVAS") as HTMLCanvasElement;
    expect([frame.width, frame.height]).toEqual([3000, 3000]);
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 3000, 3000);
    // 5% margin: the 800x600 wall fills 2700 px of width and is centred vertically.
    const [, x, y, width, height] = context.drawImage.mock.calls[0]!;
    expect(x).toBeCloseTo(150);
    expect(width).toBeCloseTo(2700);
    expect(height).toBeCloseTo(2025);
    expect(y).toBeCloseTo((3000 - 2025) / 2);
    const anchor = createSpy.mock.results
      .map((entry) => entry.value as HTMLElement)
      .find((element) => element.tagName === "A") as HTMLAnchorElement;
    expect(anchor.getAttribute("download")).toBe("testuser_album_wall_desktop.png");
    expect(result.current.status?.message).toBe("Saved");
  });
});

describe("useGridExport capture size", () => {
  async function captureScale(width: number, height: number, size = 3000) {
    const grid = createGridWithLabels();
    Object.defineProperty(grid, "offsetWidth", { value: width });
    Object.defineProperty(grid, "offsetHeight", { value: height });
    const { result } = renderHook(() =>
      useExportWithToast("u", [{ id: 1, title: "A", artist: "B" }])
    );
    act(() => {
      result.current.gridRef.current = grid;
    });
    wallMock.mockReset();
    resolveCanvas({ width: 10, height: 10 });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback: BlobCallback) =>
      callback(new Blob(["png"], { type: "image/png" }))
    );
    vi.spyOn(window.navigator, "canShare").mockReturnValue(false);
    await act(async () => {
      await result.current.shareOrSaveImage({
        id: "desktop",
        label: "Desktop",
        width: size,
        height: size,
      });
    });
    return wallMock.mock.calls[0]![0].scale;
  }

  it("captures a narrow phone wall at the size it is printed instead of stretching it", async () => {
    expect(await captureScale(340, 200)).toBeCloseTo(2700 / 340);
  });

  it("keeps the capture within a canvas size phones can render", async () => {
    expect(await captureScale(200, 200, 10000)).toBeCloseTo(4096 / 200);
  });
});

describe("useGridExport image size at the screen's own size", () => {
  const originalRatio = window.devicePixelRatio;

  afterEach(() => {
    Object.defineProperty(window, "devicePixelRatio", { value: originalRatio, configurable: true });
    delete (window as { ontouchstart?: unknown }).ontouchstart;
  });

  async function defaultScale(width: number, height: number, ratio: number, touch = false) {
    Object.defineProperty(window, "devicePixelRatio", { value: ratio, configurable: true });
    if (touch) (window as { ontouchstart?: unknown }).ontouchstart = null;
    const grid = createGridWithLabels();
    Object.defineProperty(grid, "offsetWidth", { value: width });
    Object.defineProperty(grid, "offsetHeight", { value: height });
    const { result } = renderHook(() =>
      useExportWithToast("u", [{ id: 1, title: "A", artist: "B" }])
    );
    act(() => {
      result.current.gridRef.current = grid;
    });
    wallMock.mockReset();
    resolveCanvas({
      width: 10,
      height: 10,
      toBlob: (callback: BlobCallback) => callback(new Blob(["png"], { type: "image/png" })),
    });
    vi.spyOn(window.navigator, "canShare").mockReturnValue(false);
    await act(async () => {
      await result.current.shareOrSaveImage();
    });
    return wallMock.mock.calls[0]![0].scale;
  }

  it("saves an 8 x 4 wall at about three million pixels on a computer", async () => {
    const scale = await defaultScale(1120, 552, 2);
    expect(1120 * scale * 552 * scale).toBeCloseTo(3_000_000, -3);
  });

  it("saves a phone wall as large as a computer's instead of at the screen's size", async () => {
    // A phone shows an 8 x 4 wall about 354 x 174 pixels; at the screen's density each cover was ~80 px.
    const scale = await defaultScale(354, 174, 3, true);
    expect(354 * scale).toBeGreaterThan(2400);
    expect(354 * scale * 174 * scale).toBeCloseTo(3_000_000, -3);
  });

  it("keeps a tall wall within a canvas size phones can render", async () => {
    const scale = await defaultScale(100, 2000, 3, true);
    expect(2000 * scale).toBeLessThanOrEqual(4096);
  });
});

describe("useGridExport progress", () => {
  it("shows a busy notice while the image is prepared and clears it after a silent share", async () => {
    const grid = createGridWithLabels();
    const { result } = renderHook(() =>
      useExportWithToast("u", [{ id: 1, title: "A", artist: "B" }])
    );
    act(() => {
      result.current.gridRef.current = grid;
    });
    let finish: (value: {
      canvas: HTMLCanvasElement;
      left: number;
      tiles: never[];
    }) => void = () => {};
    wallMock.mockReset();
    wallMock.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    vi.spyOn(window.navigator, "canShare").mockReturnValue(true);
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "share", { value: share, configurable: true });

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.shareOrSaveImage();
    });
    expect(result.current.status).toMatchObject({ message: "Preparing image...", busy: true });

    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "toBlob").mockImplementation((callback: BlobCallback) =>
      callback(new Blob(["png"], { type: "image/png" }))
    );
    await act(async () => {
      finish({ canvas, left: 0, tiles: [] });
      await pending;
    });
    expect(share).toHaveBeenCalled();
    expect(result.current.status).toBeNull();
  });
});

describe("useGridExport background and guide", () => {
  const album = { id: 1, title: "A", artist: "B" };

  it("draws a picture on the chosen colour", async () => {
    const grid = createGridWithLabels();
    const { result } = renderHook(() => useExportWithToast("testuser", [album]));
    act(() => {
      result.current.gridRef.current = grid;
    });
    wallMock.mockReset();
    resolveCanvas({ width: 800, height: 600 });
    const context = { fillStyle: "", fillRect: vi.fn(), drawImage: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      context as unknown as CanvasRenderingContext2D
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback: BlobCallback) =>
      callback(new Blob(["png"], { type: "image/png" }))
    );

    await act(async () => {
      await result.current.shareOrSaveImage(
        { id: "phone", label: "Phone", width: 1179, height: 2556 },
        { color: "#f1f3f9", record: false }
      );
    });

    expect(wallMock.mock.calls[0]![0]).toMatchObject({ background: "#f1f3f9" });
    expect(context.fillStyle).toBe("#f1f3f9");
    expect(drawRecordBackground).not.toHaveBeenCalled();
  });

  it("draws the record behind the wall, and the wall on nothing so the record shows through", async () => {
    const grid = createGridWithLabels();
    const { result } = renderHook(() => useExportWithToast("testuser", [album]));
    act(() => {
      result.current.gridRef.current = grid;
    });
    wallMock.mockReset();
    resolveCanvas({ width: 800, height: 600 });
    const context = { fillStyle: "", fillRect: vi.fn(), drawImage: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      context as unknown as CanvasRenderingContext2D
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback: BlobCallback) =>
      callback(new Blob(["png"], { type: "image/png" }))
    );

    await act(async () => {
      await result.current.shareOrSaveImage(
        { id: "phone", label: "Phone", width: 1179, height: 2556 },
        { color: "#0b0f17", record: true }
      );
    });

    expect(wallMock.mock.calls[0]![0]).toMatchObject({ background: "rgba(0, 0, 0, 0)" });
    expect(drawRecordBackground).toHaveBeenCalledWith(context, 1179, 2556);
  });

  it("makes the hanging guide from the wall's albums and saves it as a PDF", async () => {
    const grid = createGridWithLabels();
    const { result } = renderHook(() => useExportWithToast("testuser", [album]));
    act(() => {
      result.current.gridRef.current = grid;
    });
    vi.mocked(makeGuide).mockResolvedValue({
      pdf: new Blob(["%PDF"], { type: "application/pdf" }),
      coversLeftOut: 0,
    });
    vi.spyOn(window.navigator, "canShare").mockReturnValue(false);
    const createSpy = vi.spyOn(document, "createElement");

    await act(async () => {
      await result.current.saveGuide({ albums: [album], rows: 4, columns: 8 });
    });

    expect(vi.mocked(makeGuide).mock.calls[0]![0]).toMatchObject({
      grid,
      albums: [album],
      rows: 4,
      columns: 8,
      title: "testuser's wall",
    });
    const anchor = createSpy.mock.results
      .map((entry) => entry.value as HTMLElement)
      .find((element) => element.tagName === "A") as HTMLAnchorElement;
    expect(anchor.getAttribute("download")).toBe("testuser_album_wall_guide.pdf");
    expect(result.current.status?.message).toBe("Saved");
  });

  it("passes the steps from the wall hung last time on to the guide", async () => {
    const grid = createGridWithLabels();
    const { result } = renderHook(() => useExportWithToast("testuser", [album]));
    act(() => {
      result.current.gridRef.current = grid;
    });
    vi.mocked(makeGuide).mockResolvedValue({
      pdf: new Blob(["%PDF"], { type: "application/pdf" }),
      coversLeftOut: 0,
    });
    vi.spyOn(window.navigator, "canShare").mockReturnValue(false);
    const changes = { since: "14 Oct 2026", lines: ["Take down A from R1 C1"] };

    await act(async () => {
      await result.current.saveGuide({ albums: [album], rows: 4, columns: 8 }, changes);
    });

    expect(vi.mocked(makeGuide).mock.calls.at(-1)![0]).toMatchObject({ changes });
  });

  it("says so when the guide cannot be made", async () => {
    const { result } = renderHook(() => useExportWithToast("testuser", [album]));
    act(() => {
      result.current.gridRef.current = createGridWithLabels();
    });
    vi.mocked(makeGuide).mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await act(async () => {
      await result.current.saveGuide({ albums: [album], rows: 4, columns: 8 });
    });

    expect(result.current.status).toEqual({ message: "Could not save the guide", tone: "error" });
  });

  it("has nothing to make a guide of without albums", async () => {
    const { result } = renderHook(() => useExportWithToast("testuser", [album]));
    act(() => {
      result.current.gridRef.current = createGridWithLabels();
    });
    await act(async () => {
      await result.current.saveGuide({ albums: [], rows: 4, columns: 8 });
    });
    expect(result.current.status).toEqual({ message: "No albums", tone: "error" });
  });
});

describe("useGridExport poster", () => {
  const album = { id: 1, title: "A", artist: "B" };
  const wall = { albums: [album], rows: 4, columns: 8 };

  it("has the poster drawn by the service and saves it as a JPEG named for its size", async () => {
    const { result } = renderHook(() => useExportWithToast("testuser", [album]));
    vi.mocked(requestPoster).mockResolvedValue({
      blob: new Blob(["jpeg"], { type: "image/jpeg" }),
      coversLeftOut: 0,
    });
    vi.spyOn(window.navigator, "canShare").mockReturnValue(false);
    const createSpy = vi.spyOn(document, "createElement");

    await act(async () => {
      await result.current.savePoster(wall, { size: "24x36", background: "record" });
    });

    expect(requestPoster).toHaveBeenCalledWith({
      ...wall,
      size: "24x36",
      background: "record",
    });
    const anchor = createSpy.mock.results
      .map((entry) => entry.value as HTMLElement)
      .find((element) => element.tagName === "A") as HTMLAnchorElement;
    expect(anchor.getAttribute("download")).toBe("testuser_album_wall_poster_24x36.jpg");
    expect(result.current.status?.message).toBe("Saved");
  });

  it("says why a poster could not be made", async () => {
    const { result } = renderHook(() => useExportWithToast("testuser", [album]));
    vi.mocked(requestPoster).mockRejectedValue(new PosterError("Posters are used up for today"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await act(async () => {
      await result.current.savePoster(wall, { size: "18x24", background: "dark" });
    });

    expect(result.current.status).toEqual({
      message: "Posters are used up for today",
      tone: "error",
    });
  });

  it("has nothing to make a poster of without albums", async () => {
    const { result } = renderHook(() => useExportWithToast("testuser", [album]));
    await act(async () => {
      await result.current.savePoster(
        { albums: [], rows: 4, columns: 8 },
        { size: "18x24", background: "dark" }
      );
    });
    expect(result.current.status).toEqual({ message: "No albums", tone: "error" });
  });
});
