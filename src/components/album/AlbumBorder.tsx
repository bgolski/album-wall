interface AlbumBorderProps {
  isPinned: boolean;
}

export function AlbumBorder({ isPinned }: AlbumBorderProps) {
  return (
    <div
      className={`absolute top-0 left-0 right-0 bottom-0 rounded-lg pointer-events-none ${
        isPinned ? "border-4 border-blue-400" : "border border-gray-600"
      }`}
    />
  );
}
