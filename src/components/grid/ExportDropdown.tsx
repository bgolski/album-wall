interface ExportDropdownProps {
  isOpen: boolean;
  isExporting: boolean;
  canShareLink: boolean;
  onShareOrSaveImage: () => void;
  onShareLink: () => void;
  onCopyShareLink: () => void;
}

/**
 * Displays the export actions: save or share the wall as an image, share its link, or copy it.
 */
export function ExportDropdown({
  isOpen,
  isExporting,
  canShareLink,
  onShareOrSaveImage,
  onShareLink,
  onCopyShareLink,
}: ExportDropdownProps) {
  if (!isOpen) return null;

  const itemClass =
    "block w-full text-left px-4 py-2 text-gray-800 hover:bg-gray-100 disabled:opacity-50";

  return (
    <div className="absolute right-0 z-40 mt-2 w-48 rounded-md bg-white shadow-lg">
      <div className="py-1">
        <button onClick={onShareOrSaveImage} disabled={isExporting} className={itemClass}>
          {isExporting ? "Preparing image..." : "Share or Save Image"}
        </button>
        {canShareLink && (
          <button onClick={onShareLink} disabled={isExporting} className={itemClass}>
            Share Link
          </button>
        )}
        <button onClick={onCopyShareLink} disabled={isExporting} className={itemClass}>
          Copy Share Link
        </button>
      </div>
    </div>
  );
}
