import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadBlob } from "./download";
import { isAbortError } from "./errors";

describe("downloadBlob", () => {
  const createObjectURL = vi.fn(() => "blob:saved");
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("saves the file under its name through a temporary link", () => {
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      expect(document.body.contains(this)).toBe(true);
      clicked.push(this);
    });
    const blob = new Blob(["{}"], { type: "application/json" });

    downloadBlob(blob, "walls.json");

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clicked).toHaveLength(1);
    expect(clicked[0]!.getAttribute("href")).toBe("blob:saved");
    expect(clicked[0]!.getAttribute("download")).toBe("walls.json");
    expect(document.body.contains(clicked[0]!)).toBe(false);
  });

  it("lets the browser start the download before the address is released", () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    downloadBlob(new Blob(["x"]), "a.txt");
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:saved");
  });
});

describe("isAbortError", () => {
  it("recognises a cancelled share or request", () => {
    expect(isAbortError(new DOMException("Share canceled", "AbortError"))).toBe(true);
  });

  it("is false for anything else", () => {
    expect(isAbortError(new DOMException("Denied", "NotAllowedError"))).toBe(false);
    expect(isAbortError(new Error("AbortError"))).toBe(false);
    expect(isAbortError("AbortError")).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });
});
