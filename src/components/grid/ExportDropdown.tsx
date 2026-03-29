interface ExportDropdownProps {
  isOpen: boolean;
  isExporting: boolean;
  statusMessage: string | null;
  onExportCSV: () => void;
  onExportImage: () => void;
  onShareImage: () => void;
  onCopyShareLink: () => void;
}

/**
 * Displays the export actions for downloading the wall as CSV or an image.
 */
export function ExportDropdown({
  isOpen,
  isExporting,
  statusMessage,
  onExportCSV,
  onExportImage,
  onShareImage,
  onCopyShareLink,
}: ExportDropdownProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute right-0 z-40 mt-2 w-48 rounded-md bg-white shadow-lg">
      <div className="py-1">
        <button
          onClick={onExportCSV}
          className="block w-full text-left px-4 py-2 text-gray-800 hover:bg-gray-100"
        >
          Export to CSV
        </button>
        <button
          onClick={onExportImage}
          disabled={isExporting}
          className="block w-full text-left px-4 py-2 text-gray-800 hover:bg-gray-100 disabled:opacity-50"
        >
          {isExporting ? "Generating image..." : "Save as Image"}
        </button>
        <button
          onClick={onShareImage}
          disabled={isExporting}
          className="block w-full text-left px-4 py-2 text-gray-800 hover:bg-gray-100 disabled:opacity-50"
        >
          {isExporting ? "Preparing image..." : "Share Image"}
        </button>
        <button
          onClick={onCopyShareLink}
          className="block w-full text-left px-4 py-2 text-gray-800 hover:bg-gray-100"
        >
          Copy Share Link
        </button>
        {statusMessage && (
          <p className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100">
            {statusMessage}
          </p>
        )}
      </div>
    </div>
  );
}
