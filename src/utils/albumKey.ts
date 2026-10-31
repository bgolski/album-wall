import type { Album } from "@/types";

/** An album's id as text: the form pins, saved walls, history and share links use. */
export function albumKey(album: Pick<Album, "id">): string {
  return String(album.id);
}

/** The id a cover has while it can be dragged. */
export function dragId(album: Pick<Album, "id">): string {
  return `album-${album.id}`;
}
