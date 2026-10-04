import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useGridExport } from "./useGridExport";
import html2canvas from "html2canvas-pro";

// Mock html2canvas module
vi.mock("html2canvas-pro", () => ({
  default: vi.fn(),
}));

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
  window.alert = originalAlert;
  Object.defineProperty(window, "URL", { value: originalURL, configurable: true });
  Object.defineProperty(window, "navigator", { value: originalNavigator, configurable: true });
  document.body.innerHTML = "";
});

describe("useGridExport", () => {
  const username = "testuser";
  const albums = [{ id: 1, title: "Album 1", artist: "Artist 1", imageUrl: "" }];

  it("toggles dropdown open state", () => {
    const { result } = renderHook(() => useGridExport(username, albums));
    expect(result.current.dropdownOpen).toBe(false);
    act(() => {
      result.current.toggleDropdown();
    });
    expect(result.current.dropdownOpen).toBe(true);
    act(() => {
      result.current.toggleDropdown();
    });
    expect(result.current.dropdownOpen).toBe(false);
  });

  it("reports in the status line when no grid or albums and closes dropdown", async () => {
    const { result } = renderHook(() => useGridExport(username, []));
    act(() => {
      result.current.toggleDropdown();
    });
    expect(result.current.dropdownOpen).toBe(true);
    await act(async () => {
      await result.current.shareOrSaveImage();
    });
    expect(window.alert).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({ message: "No albums to share.", tone: "error" });
    expect(result.current.dropdownOpen).toBe(false);
  });

  it("reports in the status line when grid is missing even with albums", async () => {
    const { result } = renderHook(() => useGridExport(username, albums));
    // gridRef.current stays null
    await act(async () => {
      await result.current.shareOrSaveImage();
    });
    expect(window.alert).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({ message: "No albums to share.", tone: "error" });
    expect(result.current.dropdownOpen).toBe(false);
    expect(result.current.isExporting).toBe(false);
  });

  it("reports in the status line when albums are empty even with a grid present", async () => {
    const grid = createGridWithLabels();
    const { result } = renderHook(() => useGridExport(username, []));
    act(() => {
      result.current.gridRef.current = grid;
    });
    await act(async () => {
      await result.current.shareOrSaveImage();
    });
    expect(window.alert).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({ message: "No albums to share.", tone: "error" });
    expect(result.current.dropdownOpen).toBe(false);
    expect(result.current.isExporting).toBe(false);
  });

  it("hides labels, restores display, and downloads when share not available", async () => {
    const grid = createGridWithLabels();
    const { result } = renderHook(() => useGridExport(username, albums));
    act(() => {
      result.current.gridRef.current = grid;
    });
    const blob = new Blob(["png"], { type: "image/png" });
    const html2canvasMock = vi.mocked(html2canvas as unknown as ReturnType<typeof vi.fn>);
    html2canvasMock.mockResolvedValue(mockCanvasToBlob(blob));
    vi.spyOn(window.navigator, "canShare").mockReturnValue(false);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click");

    await act(async () => {
      await result.current.shareOrSaveImage();
    });

    const labels = grid.querySelectorAll<HTMLElement>(".album-labels");
    labels.forEach((label) => {
      expect(label.style.display).toBe("flex");
    });

    expect(clickSpy).toHaveBeenCalled();
    expect(result.current.status?.message).toBe("Image saved.");
  });

  it("passes correct filename to downloadBlob", async () => {
    const grid = createGridWithLabels();
    const { result } = renderHook(() => useGridExport("testuser", albums));
    act(() => {
      result.current.gridRef.current = grid;
    });
    const blob = new Blob(["png"], { type: "image/png" });
    const html2canvasMock = vi.mocked(html2canvas as unknown as ReturnType<typeof vi.fn>);
    html2canvasMock.mockResolvedValue(mockCanvasToBlob(blob));
    vi.spyOn(window.navigator, "canShare").mockReturnValue(false);
    const createSpy = vi.spyOn(document, "createElement");

    await act(async () => {
      await result.current.shareOrSaveImage();
    });

    const anchorEl = createSpy.mock.results[0]!.value as HTMLAnchorElement;
    expect(anchorEl.tagName).toBe("A");
    expect(anchorEl.getAttribute("download")).toBe("testuser_vinyl_wall.png");
  });

  it("uses native share when supported", async () => {
    const grid = createGridWithLabels();
    const { result } = renderHook(() => useGridExport(username, albums));
    act(() => {
      result.current.gridRef.current = grid;
    });
    const blob = new Blob(["png"], { type: "image/png" });
    const html2canvasMock = vi.mocked(html2canvas as unknown as ReturnType<typeof vi.fn>);
    html2canvasMock.mockResolvedValue(mockCanvasToBlob(blob));
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
    const { result } = renderHook(() => useGridExport(username, albums));
    act(() => {
      result.current.gridRef.current = grid;
    });
    const blob = new Blob(["png"], { type: "image/png" });
    const html2canvasMock = vi.mocked(html2canvas as unknown as ReturnType<typeof vi.fn>);
    html2canvasMock.mockResolvedValue(mockCanvasToBlob(blob));
    const shareSpy = vi
      .spyOn(window.navigator, "share")
      .mockRejectedValueOnce(new DOMException("needs a tap", "NotAllowedError"))
      .mockResolvedValue();
    vi.spyOn(window.navigator, "canShare").mockReturnValue(true);

    await act(async () => {
      await result.current.shareOrSaveImage();
    });

    expect(result.current.status?.message).toBe("Image ready.");
    expect(result.current.status?.tone).toBe("info");
    expect(shareSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.status?.action?.run();
    });

    expect(shareSpy).toHaveBeenCalledTimes(2);
    const [shared] = shareSpy.mock.calls[1] as unknown as [{ files: File[] }];
    expect(shared.files[0]!.name).toBe("testuser_vinyl_wall.png");
  });

  it("names the demo wall's image Demo_vinyl_wall.png, not after its reserved username", async () => {
    const grid = createGridWithLabels();
    const { result } = renderHook(() => useGridExport("~demo", albums));
    act(() => {
      result.current.gridRef.current = grid;
    });
    const blob = new Blob(["png"], { type: "image/png" });
    const html2canvasMock = vi.mocked(html2canvas as unknown as ReturnType<typeof vi.fn>);
    html2canvasMock.mockResolvedValue(mockCanvasToBlob(blob));
    vi.spyOn(window.navigator, "canShare").mockReturnValue(false);
    const createSpy = vi.spyOn(document, "createElement");

    await act(async () => {
      await result.current.shareOrSaveImage();
    });

    const anchorEl = createSpy.mock.results[0]!.value as HTMLAnchorElement;
    expect(anchorEl.getAttribute("download")).toBe("Demo_vinyl_wall.png");
  });

  it("uses Anonymous_vinyl_wall.png filename when username is empty", async () => {
    const grid = createGridWithLabels();
    const { result } = renderHook(() => useGridExport("", albums));
    act(() => {
      result.current.gridRef.current = grid;
    });
    const blob = new Blob(["png"], { type: "image/png" });
    const html2canvasMock = vi.mocked(html2canvas as unknown as ReturnType<typeof vi.fn>);
    html2canvasMock.mockResolvedValue(mockCanvasToBlob(blob));
    vi.spyOn(window.navigator, "canShare").mockReturnValue(false);
    const createSpy = vi.spyOn(document, "createElement");

    await act(async () => {
      await result.current.shareOrSaveImage();
    });

    const anchorEl = createSpy.mock.results[0]!.value as HTMLAnchorElement;
    expect(anchorEl.tagName).toBe("A");
    expect(anchorEl.getAttribute("download")).toBe("Anonymous_vinyl_wall.png");
  });

  it("handles AbortError from share as cancelation", async () => {
    const grid = createGridWithLabels();
    const { result } = renderHook(() => useGridExport(username, albums));
    act(() => {
      result.current.gridRef.current = grid;
    });
    const blob = new Blob(["png"], { type: "image/png" });
    const html2canvasMock = vi.mocked(html2canvas as unknown as ReturnType<typeof vi.fn>);
    html2canvasMock.mockResolvedValue(mockCanvasToBlob(blob));
    const abortErr = new DOMException("", "AbortError");
    vi.spyOn(window.navigator, "share").mockRejectedValue(abortErr);
    vi.spyOn(window.navigator, "canShare").mockReturnValue(true);

    await act(async () => {
      await result.current.shareOrSaveImage();
    });

    expect(result.current.status?.message).toBe("Save canceled.");
    expect(window.alert).not.toHaveBeenCalled();
  });

  it("handles generic export errors in the status line", async () => {
    const grid = createGridWithLabels();
    const { result } = renderHook(() => useGridExport(username, albums));
    act(() => {
      result.current.gridRef.current = grid;
    });
    const error = new Error("boom");
    const html2canvasMock = vi.mocked(html2canvas as unknown as ReturnType<typeof vi.fn>);
    html2canvasMock.mockRejectedValue(error);

    await act(async () => {
      await result.current.shareOrSaveImage();
    });

    expect(window.alert).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({
      message: "Failed to export image. Please try again.",
      tone: "error",
    });
  });

  it("clears the status after a few seconds", async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useGridExport(username, []));
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
      useGridExport("testuser", [{ id: 1, title: "A", artist: "B" }])
    );
    act(() => {
      result.current.gridRef.current = grid;
    });
    const captured = { width: 800, height: 600 };
    vi.mocked(html2canvas as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(captured);
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
        id: "square",
        label: "Square print",
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
    expect(anchor.getAttribute("download")).toBe("testuser_vinyl_wall_square.png");
    expect(result.current.status?.message).toBe("Image saved.");
  });
});

describe("useGridExport capture size", () => {
  async function captureScale(width: number, height: number, size = 3000) {
    const grid = createGridWithLabels();
    Object.defineProperty(grid, "offsetWidth", { value: width });
    Object.defineProperty(grid, "offsetHeight", { value: height });
    const { result } = renderHook(() => useGridExport("u", [{ id: 1, title: "A", artist: "B" }]));
    act(() => {
      result.current.gridRef.current = grid;
    });
    const html2canvasMock = vi.mocked(html2canvas as unknown as ReturnType<typeof vi.fn>);
    html2canvasMock.mockReset();
    html2canvasMock.mockResolvedValue({ width: 10, height: 10 });
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
        id: "square",
        label: "Square print",
        width: size,
        height: size,
      });
    });
    return (html2canvasMock.mock.calls[0]![1] as { scale: number }).scale;
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
    const { result } = renderHook(() => useGridExport("u", [{ id: 1, title: "A", artist: "B" }]));
    act(() => {
      result.current.gridRef.current = grid;
    });
    const html2canvasMock = vi.mocked(html2canvas as unknown as ReturnType<typeof vi.fn>);
    html2canvasMock.mockReset();
    html2canvasMock.mockResolvedValue({
      width: 10,
      height: 10,
      toBlob: (callback: BlobCallback) => callback(new Blob(["png"], { type: "image/png" })),
    });
    vi.spyOn(window.navigator, "canShare").mockReturnValue(false);
    await act(async () => {
      await result.current.shareOrSaveImage();
    });
    return (html2canvasMock.mock.calls[0]![1] as { scale: number }).scale;
  }

  it("keeps a saved wall to about a million pixels on a high-density computer screen", async () => {
    // A 1120 x 552 wall at the old 2x-density scale of 4 would be about 9.9 million pixels.
    const scale = await defaultScale(1120, 552, 2);
    expect(1120 * scale * 552 * scale).toBeCloseTo(1_300_000, -3);
  });

  it("still saves a small wall at twice the screen's density", async () => {
    expect(await defaultScale(354, 354, 1)).toBe(2);
  });

  it("saves a phone wall at the screen's density without exceeding the budget", async () => {
    expect(await defaultScale(354, 354, 3, true)).toBe(2);
    const wide = await defaultScale(1120, 552, 3, true);
    expect(1120 * wide * 552 * wide).toBeLessThanOrEqual(1_300_001);
  });
});
