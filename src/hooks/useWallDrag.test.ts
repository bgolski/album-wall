import { describe, expect, it } from "vitest";
import type { CollisionDetection } from "@dnd-kit/core";
import { wallCollisionDetection } from "./useWallDrag";

type Args = Parameters<CollisionDetection>[0];

// Three covers one above the other, 100 pixels square with a 14 pixel gap, as droppables.
const rect = (top: number) => ({
  top,
  bottom: top + 100,
  left: 0,
  right: 100,
  width: 100,
  height: 100,
});
const droppableRects = new Map([
  ["album-1", rect(0)],
  ["album-2", rect(114)],
  ["album-3", rect(228)],
]);
const droppableContainers = [...droppableRects.keys()].map((id) => ({ id })) as never;

function args(pointer: { x: number; y: number } | null, draggedTop = 0): Args {
  return {
    active: { id: "album-3" },
    collisionRect: rect(draggedTop),
    droppableRects,
    droppableContainers,
    pointerCoordinates: pointer,
  } as unknown as Args;
}

const over = (pointer: { x: number; y: number } | null, draggedTop?: number) =>
  wallCollisionDetection(args(pointer, draggedTop))[0]?.id;

describe("wallCollisionDetection", () => {
  it("picks the album under the pointer, whatever part of the dragged cover was grabbed", () => {
    // The dragged cover's own position (collisionRect) does not matter, only the pointer.
    expect(over({ x: 50, y: 125 }, -20)).toBe("album-2");
    expect(over({ x: 50, y: 125 }, 300)).toBe("album-2");
    expect(over({ x: 50, y: 205 }, 150)).toBe("album-2");
  });

  it("gives a gap to the nearer cover, so there is no spot between them", () => {
    // The gap between the first and second covers runs from 100 to 114.
    expect(over({ x: 50, y: 104 })).toBe("album-1");
    expect(over({ x: 50, y: 110 })).toBe("album-2");
  });

  it("is over nothing once the pointer is away from every cover, so letting go swaps nothing", () => {
    expect(over({ x: 400, y: 50 })).toBeUndefined();
    expect(over({ x: 50, y: 400 })).toBeUndefined();
    expect(over({ x: -60, y: 50 })).toBeUndefined();
  });

  it("falls back to the nearest center with no pointer, as with the keyboard", () => {
    expect(over(null, 112)).toBe("album-2");
  });

  it("does not change its mind when the pointer stays put", () => {
    const first = wallCollisionDetection(args({ x: 50, y: 107 }, 0));
    const second = wallCollisionDetection(args({ x: 50, y: 107 }, 200));
    expect(second.map((hit) => hit.id)).toEqual(first.map((hit) => hit.id));
  });
});
