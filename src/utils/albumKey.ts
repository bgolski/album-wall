import type { UniqueIdentifier } from "@dnd-kit/core";
import type { Album } from "@/types";

/** An album's id as text: the form pins, saved walls, history and share links use. */
export function albumKey(album: Pick<Album, "id">): string {
  return String(album.id);
}

/** The id a cover has while it can be dragged. */
export function dragId(album: Pick<Album, "id">): string {
  return `album-${album.id}`;
}

/** The album key in a drag id, or null for anything that is not a cover's drag id. */
export function albumKeyFromDragId(id: UniqueIdentifier): string | null {
  if (typeof id === "string" && id.startsWith("album-") && id.length > 6) {
    return id.slice(6) || null;
  }
  return null;
}
