import { afterEach, describe, expect, it, vi } from "vitest";
import { copyLink, copyText } from "./copyText";

function stubClipboard(writeText?: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  });
}

function stubExecCommand(result: boolean | "throw") {
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    value: vi.fn(() => {
      if (result === "throw") throw new Error("not supported");
      return result;
    }),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  stubClipboard(undefined);
});

describe("copyText", () => {
  it("uses the clipboard when it allows it", async () => {
    const writeText = vi.fn(async () => {});
    stubClipboard(writeText);
    stubExecCommand(false);
    expect(await copyText("hello")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
    expect(document.execCommand).not.toHaveBeenCalled();
  });

  it("falls back to the copy command when the clipboard refuses", async () => {
    stubClipboard(async () => {
      throw new DOMException("Document is not focused.", "NotAllowedError");
    });
    stubExecCommand(true);
    expect(await copyText("hello")).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("uses the copy command when there is no clipboard", async () => {
    stubClipboard(undefined);
    stubExecCommand(true);
    expect(await copyText("hello")).toBe(true);
  });

  it("reports failure when neither works", async () => {
    stubClipboard(async () => {
      throw new Error("no");
    });
    stubExecCommand("throw");
    expect(await copyText("hello")).toBe(false);
    expect(document.querySelector("textarea")).toBeNull();
  });
});

describe("copyLink", () => {
  it("shows the link to copy by hand when copying is not allowed", async () => {
    stubClipboard(undefined);
    stubExecCommand(false);
    const prompt = vi.spyOn(window, "prompt").mockReturnValue(null);
    expect(await copyLink("https://example.test/#share=abc")).toBe("shown");
    expect(prompt).toHaveBeenCalledWith("Copy this link:", "https://example.test/#share=abc");
  });

  it("does not show anything when the link was copied", async () => {
    stubClipboard(async () => {});
    const prompt = vi.spyOn(window, "prompt").mockReturnValue(null);
    expect(await copyLink("https://example.test/")).toBe("copied");
    expect(prompt).not.toHaveBeenCalled();
  });
});
