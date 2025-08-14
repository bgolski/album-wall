interface ExportDropdownProps {
  isOpen: boolean;
  isExporting: boolean;
  onExportCSV: () => void;
  onExportImage: () => void;
}

export function ExportDropdown({
  isOpen,
  isExporting,
  onExportCSV,
  onExportImage,
}: ExportDropdownProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10">
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
      </div>
    </div>
  );
}
