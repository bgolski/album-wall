import { useEffect, useMemo, useState } from "react";
import type { Album } from "@/types";
import type { SuggestedGradient } from "@/arrange/suggestGradients";
import type { WallGradient } from "@/arrange/buildGradientWall";
import { useCoverColors } from "@/hooks/useCoverColors";
import { runGradientJob } from "@/arrange/gradientJobs";

/**
 * Everything Sort by Color's gradient builder needs: the covers' colors (measured across the whole
 * collection once it is opened, and not before), suggestions once every cover is read, and a
 * build that fills the wall as one reorder, so one Undo puts the previous wall back. Suggestions
 * and builds run in a worker, so large collections do not freeze the page.
 *
 * @param input.albums The whole collection in its current order.
 * @returns Profiles and progress, suggestions, and `build`.
 */
export function useGradientBuilder(input: {
  albums: Album[];
  rows: number;
  columns: number;
  pinnedAlbums: Set<string>;
  onAlbumsReorder: (albums: Album[]) => void;
  active: boolean;
  /** Extra cost by album id when a wall should prefer records not hung recently. */
  restCost?: Readonly<Record<string, number>>;
}) {
  const { albums, rows, columns, pinnedAlbums, onAlbumsReorder, active } = input;
  const { profiles, pending, total } = useCoverColors(albums, active);

  // Suggestions need every cover's colors; each request is answered for exactly these inputs.
  const request = useMemo(
    () => (active && pending === 0 ? { albums, profiles, rows, columns } : null),
    [active, pending, albums, profiles, rows, columns]
  );
  const [answered, setAnswered] = useState<{
    request: typeof request;
    suggestions: SuggestedGradient[];
  }>({ request: null, suggestions: [] });
  useEffect(() => {
    if (!request) return;
    let current = true;
    void runGradientJob({ kind: "suggest", input: request }).then((result) => {
      if (current) setAnswered({ request, ...result });
    });
    return () => {
      current = false;
    };
  }, [request]);
  const { suggestions } = request && answered.request === request ? answered : { suggestions: [] };

  /**
   * Fills the wall with the covers that best fit a gradient.
   *
   * @param keepArtistsApart Whether covers by the same artist may touch.
   * @param preferRested Whether records hung recently should be passed over when others fit.
   * @returns What the build did, for the panel's status line.
   */
  const build = async (gradient: WallGradient, keepArtistsApart: boolean, preferRested = false) => {
    const { order, ...built } = await runGradientJob({
      kind: "build",
      input: {
        ...(preferRested && input.restCost ? { extraCost: input.restCost } : {}),
        albums,
        rows,
        columns,
        pinned: pinnedAlbums,
        profiles,
        gradient,
        keepArtistsApart,
      },
    });
    const byId = new Map(albums.map((album) => [album.id, album]));
    onAlbumsReorder(order.map((id) => byId.get(id)!).filter(Boolean));
    return { ...built, keepArtistsApart };
  };

  return { profiles, pending, total, suggestions, build };
}
