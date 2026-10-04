import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useGridExport } from "./useGridExport";
import html2canvas from "html2canvas";

// Mock html2canvas module
vi.mock("html2canvas", () => ({
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
