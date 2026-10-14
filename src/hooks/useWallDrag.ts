import { useState } from "react";
import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { Album } from "@/types";
import { swapAlbums } from "@/utils/dragAndDropHelpers";

/** What screen readers hear about moving albums by keyboard. */
export const DRAG_INSTRUCTIONS = {
  draggable:
    "To move an album, press space or enter to pick it up, use the arrow keys to reach another album, then press space or enter to swap places, or escape to cancel. Pinned albums cannot be moved.",
};

/**
 * Dragging covers between the wall and the pool by mouse, touch or keyboard: the dragged album
 * swaps places with the one it is dropped on, and each step is announced for screen readers.
 *
 * @param input.wallAlbums The wall in the order shown, for naming slots.
 * @param input.displayedAlbums Albums on the wall.
 * @param input.poolItems Albums in the pool.
 * @param input.pinnedAlbums Ids of pinned albums.
 * @param input.onAlbumsReorder Applies a new order.
 * @returns Sensors, the album being dragged, handlers and announcements for DndContext.
 */
export function useWallDrag(input: {
  wallAlbums: Album[];
  displayedAlbums: Album[];
  poolItems: Album[];
  pinnedAlbums: Set<string>;
  onAlbumsReorder: (albums: Album[]) => void;
}) {
  const { wallAlbums, displayedAlbums, poolItems, pinnedAlbums, onAlbumsReorder } = input;
  const [draggedAlbum, setDraggedAlbum] = useState<Album | null>(null);

  const mouseSensor = useSensor(MouseSensor, { activationConstraint: { distance: 8 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { distance: 4 } });
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });
  const sensors = useSensors(mouseSensor, touchSensor, keyboardSensor);

  /**
   * Remembers the dragged album so the drag overlay can show its cover above both panels.
   *
   * @param event DnD Kit drag start event.
   */
  const onDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    setDraggedAlbum(
      [...displayedAlbums, ...poolItems].find((album) => `album-${album.id}` === id) ?? null
    );
  };

  /**
   * Swaps the dragged album with the album it was dropped on; everything else stays in place.
   *
   * @param event DnD Kit drag end event.
   */
  const onDragEnd = (event: DragEndEvent) => {
    setDraggedAlbum(null);
    const { active, over } = event;
    if (!over) return;

    const { newDisplayedAlbums, newPoolItems } = swapAlbums(
      displayedAlbums,
      poolItems,
      active.id,
      over.id,
      pinnedAlbums
    );
    if (newDisplayedAlbums === displayedAlbums && newPoolItems === poolItems) return;

    onAlbumsReorder([...newDisplayedAlbums, ...newPoolItems]);
  };

  /**
   * Describes where an album sits so drag announcements can name its slot: a wall slot is
   * numbered in the order shown, a pool position in the pool's order.
   *
   * @param id DnD Kit item identifier (`album-<id>`).
   * @returns The album and its place, or null when it is in neither list.
   */
  const describeAlbum = (id: UniqueIdentifier) => {
    const wallIndex = wallAlbums.findIndex((album) => `album-${album.id}` === id);
    if (wallIndex !== -1) {
      const album = wallAlbums[wallIndex]!;
      return {
        name: `${album.title || "Untitled"} by ${album.artist}`,
        place: `wall slot ${wallIndex + 1}`,
      };
    }
    const poolIndex = poolItems.findIndex((album) => `album-${album.id}` === id);
    if (poolIndex !== -1) {
      const album = poolItems[poolIndex]!;
      return {
        name: `${album.title || "Untitled"} by ${album.artist}`,
        place: `pool position ${poolIndex + 1}`,
      };
    }
    return null;
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
