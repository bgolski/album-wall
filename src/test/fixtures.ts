import type { Album } from "@/types";

/** An album with the given id, titled `Album <id>` by `Artist <id>`, with any field overridden. */
export function makeAlbum(id: number, overrides: Partial<Album> = {}): Album {
  return {
    id,
    title: `Album ${id}`,
    artist: `Artist ${id}`,
    ...overrides,
  };
}

/** Albums 1 to `count`, each made by makeAlbum with the fields `extra(id)` returns. */
export function makeAlbums(count: number, extra?: (id: number) => Partial<Album>): Album[] {
  return Array.from({ length: count }, (_, index) => {
    const id = index + 1;
    return makeAlbum(id, extra ? extra(id) : {});
  });
}
