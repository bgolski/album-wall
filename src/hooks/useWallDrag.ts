import { useState } from "react";
import {
  KeyboardSensor,
  MouseSensor,
  closestCenter,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { Album } from "@/types";
import { swapAlbums } from "@/utils/dragAndDropHelpers";
import { dragId } from "@/utils/albumKey";

/** What screen readers hear about moving albums by keyboard. */
export const DRAG_INSTRUCTIONS = {
  draggable:
    "To move an album, press space or enter to pick it up, use the arrow keys to reach another album, then press space or enter to swap places, or escape to cancel. Pinned albums cannot be moved.",
};

// How far outside a cover the pointer still counts as over it, so the gaps between covers (12 to
// 16 pixels) belong to whichever cover is nearer and there is never a dead spot to flicker over.
const GUTTER = 12;

/**
 * Which album a drag is over: the one under the pointer, as a person aims it, using only the
 * pointer so the result does not depend on where the cover was grabbed. In a gap it is the nearer
 * cover; further from every cover than a gap (off the wall) it is none, so letting go there swaps
 * nothing. Without a pointer, as with the keyboard, it is the cover nearest the dragged one.
 */
export const wallCollisionDetection: CollisionDetection = (args) => {
  const { pointerCoordinates: pointer, droppableRects, droppableContainers } = args;
  if (!pointer) return closestCenter(args);
  const hits: ReturnType<CollisionDetection> = [];
  for (const droppableContainer of droppableContainers) {
    const rect = droppableRects.get(droppableContainer.id);
    if (!rect) continue;
    // Distance from the pointer to the cover's edge: nothing when it is on the cover.
    const outside = Math.hypot(
      Math.max(rect.left - pointer.x, 0, pointer.x - (rect.left + rect.width)),
      Math.max(rect.top - pointer.y, 0, pointer.y - (rect.top + rect.height))
    );
    if (outside > GUTTER) continue;
    // Ties (in a gap, or a corner) go to the cover whose center is nearer.
    const toCenter = Math.hypot(
      pointer.x - (rect.left + rect.width / 2),
      pointer.y - (rect.top + rect.height / 2)
    );
    hits.push({
      id: droppableContainer.id,
      data: { droppableContainer, value: outside * 1000 + toCenter },
    });
  }
  return hits.sort((a, b) => (a.data?.value ?? 0) - (b.data?.value ?? 0));
};

/**
 * Dragging covers between the wall and the pool by mouse, touch or keyboard: the dragged album
 * swaps places with the one it is dropped on, and each step is announced for screen readers.
 *
 * @param input.onAlbumsReorder Applies a new order.
 * @returns Sensors, the album being dragged, handlers and announcements for DndContext.
 */
export function useWallDrag(input: {
  displayedAlbums: Album[];
  poolItems: Album[];
  pinnedAlbums: Set<string>;
  onAlbumsReorder: (albums: Album[]) => void;
}) {
  const { displayedAlbums, poolItems, pinnedAlbums, onAlbumsReorder } = input;
  const [draggedAlbum, setDraggedAlbum] = useState<Album | null>(null);

  const mouseSensor = useSensor(MouseSensor, { activationConstraint: { distance: 8 } });
  // On touch screens a cover is picked up by pressing and holding it, so a swipe still scrolls.
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 250, tolerance: 8 },
  });
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });
  const sensors = useSensors(mouseSensor, touchSensor, keyboardSensor);

  /**
   * Remembers the dragged album so the drag overlay can show its cover above both panels.
   */
  const onDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    setDraggedAlbum(
      [...displayedAlbums, ...poolItems].find((album) => dragId(album) === id) ?? null
    );
  };

  /**
   * Swaps the dragged album with the album it was dropped on; everything else stays in place.
   */
  const onDragEnd = (event: DragEndEvent) => {
    setDraggedAlbum(null);
    const { active, over } = event;
    if (!over) return;

    const next = swapAlbums([...displayedAlbums, ...poolItems], active.id, over.id, pinnedAlbums);
    if (next) onAlbumsReorder(next);
  };

  /**
   * Describes where an album sits so drag announcements can name its slot: a wall slot is
   * numbered in the order shown, a pool position in the pool's order.
   *
   * @param id DnD Kit item identifier (`album-<id>`).
   * @returns The album and its place, or null when it is in neither list.
   */
  const describeAlbum = (id: UniqueIdentifier) => {
    const all = [...displayedAlbums, ...poolItems];
    const index = all.findIndex((album) => dragId(album) === id);
    if (index === -1) return null;
    const album = all[index]!;
    const place =
      index < displayedAlbums.length
        ? `wall slot ${index + 1}`
        : `pool position ${index - displayedAlbums.length + 1}`;
    return {
      name: `${album.title || "Untitled"} by ${album.artist}`,
      place,
    };
  };

  const announcements: Announcements = {
    onDragStart({ active }) {
      const picked = describeAlbum(active.id);
      return picked ? `Picked up ${picked.name}, ${picked.place}.` : undefined;
    },
    onDragOver({ active, over }) {
      const picked = describeAlbum(active.id);
      const target = over ? describeAlbum(over.id) : null;
      // Picking an album up reports it over itself; stay quiet so "Picked up" is what is heard.
      if (!picked || over?.id === active.id) return undefined;
      return target
        ? `${picked.name} is over ${target.name}, ${target.place}.`
        : `${picked.name} is not over an album.`;
    },
    onDragEnd({ active, over }) {
      const picked = describeAlbum(active.id);
      const target = over ? describeAlbum(over.id) : null;
      if (!picked) return undefined;
      return target && over?.id !== active.id
        ? `Dropped ${picked.name} on ${target.name}. They swap places if neither is pinned.`
        : `Dropped ${picked.name}; it stays in ${picked.place}.`;
    },
    onDragCancel({ active }) {
      const picked = describeAlbum(active.id);
      return picked ? `Move cancelled. ${picked.name} stays in ${picked.place}.` : undefined;
    },
  };

  return {
    sensors,
    draggedAlbum,
    onDragStart,
    onDragEnd,
    onDragCancel: () => setDraggedAlbum(null),
    announcements,
  };
}
