import { describe, expect, it, vi } from "vitest";
import { drawRecordBackground } from "./recordBackground";

function fakeContext(withConic: boolean) {
  const gradient = { addColorStop: vi.fn() };
  const context = {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    ...(withConic ? { createConicGradient: vi.fn(() => gradient) } : {}),
  };
  return { context: context as unknown as CanvasRenderingContext2D, raw: context, gradient };
}

describe("drawRecordBackground", () => {
  it("fills the frame with the page colour, then draws rings out to the corners", () => {
    const { context, raw } = fakeContext(true);
    drawRecordBackground(context, 1179, 2556);
    expect(raw.fillRect.mock.calls[0]).toEqual([0, 0, 1179, 2556]);
    expect(raw.arc.mock.calls.length).toBeGreaterThan(50);
    const radii = raw.arc.mock.calls.map((call) => call[2] as number);
    expect(Math.max(...radii)).toBeGreaterThan(Math.hypot(1179, 2556) / 2 - 20);
    expect(raw.arc.mock.calls.every((call) => call[0] === 1179 / 2 && call[1] === 2556 / 2)).toBe(
      true
    );
  });

  it("lays two soft bands of light across it", () => {
    const { context, raw, gradient } = fakeContext(true);
    drawRecordBackground(context, 2560, 1440);
    expect(raw.createConicGradient).toHaveBeenCalledWith(-Math.PI / 2, 1280, 720);
    expect(gradient.addColorStop).toHaveBeenCalledTimes(7);
    expect(raw.fillRect).toHaveBeenCalledTimes(2);
  });

  it("still draws the rings where conic gradients are not supported", () => {
    const { context, raw } = fakeContext(false);
    drawRecordBackground(context, 1000, 1000);
    expect(raw.arc).toHaveBeenCalled();
    expect(raw.fillRect).toHaveBeenCalledTimes(1);
  });
});
