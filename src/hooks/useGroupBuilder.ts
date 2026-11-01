import { useMemo } from "react";
import type { Album } from "@/types";
import {
  availableGroups,
  groupPlan,
  type GroupMode,
  type GroupSettings,
} from "@/arrange/groupModes";
import type { GroupBuildSummary } from "@/components/arrange/GroupPanel";
import { buildGroupWall } from "@/arrange/buildGroupWall";

/**
 * Everything the Artist, Genre and Year choices need: the groups in the collection and a build that
 * fills the wall as one reorder, so one Undo puts the previous wall back.
 *
 * @param input.albums The whole collection in its current order.
 * @param input.mode The open mode, or null when Color or By hand is chosen.
 * @returns The groups in the collection and `build`.
 */
export function useGroupBuilder(input: {
  albums: Album[];
  rows: number;
  columns: number;
  pinnedAlbums: Set<string>;
  onAlbumsReorder: (albums: Album[]) => void;
  mode: GroupMode | null;
}) {
  const { albums, rows, columns, pinnedAlbums, onAlbumsReorder, mode } = input;

  const choices = useMemo(() => (mode ? availableGroups(mode, albums) : []), [mode, albums]);

  /**
   * Fills the wall from the chosen groups.
   *
   * @param settings Groups to run, or the whole collection A to Z.
   */
  const build = (settings: GroupSettings): GroupBuildSummary => {
    const built = buildGroupWall({
      albums,
      rows,
      columns,
      pinned: pinnedAlbums,
      ...groupPlan(settings),
    });
    onAlbumsReorder(built.albums);
    return { others: built.others };
  };

  return { choices, build };
}
