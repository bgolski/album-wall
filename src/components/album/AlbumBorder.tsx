interface AlbumBorderProps {
  isPinned: boolean;
}

/**
 * Renders the visual border that distinguishes pinned albums from regular records.
 */
export function AlbumBorder({ isPinned }: AlbumBorderProps) {
  return (
    <div
      className={`absolute top-0 left-0 right-0 bottom-0 rounded-tile pointer-events-none ${
        isPinned ? "border-4 border-accent" : "border border-line"
      }`}
    />
  );
}
