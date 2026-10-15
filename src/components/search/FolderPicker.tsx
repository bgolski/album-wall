import type { DiscogsFolder } from "@/utils/discogsSignIn";

interface FolderPickerProps {
  folders: DiscogsFolder[];
  folderId: number;
  disabled: boolean;
  onChange: (folderId: number) => void;
}

/**
 * Chooses which folder of the signed-in visitor's Discogs collection to load.
 */
export function FolderPicker({ folders, folderId, disabled, onChange }: FolderPickerProps) {
  // Discogs lists "All" (id 0) first; keep it first even if it does not.
  const sorted = [...folders].sort((a, b) => (a.id === 0 ? -1 : b.id === 0 ? 1 : 0));
  const value = sorted.some((folder) => folder.id === folderId) ? folderId : 0;

  return (
    <div className="mt-2 flex w-full max-w-sm items-center gap-2 text-sm sm:max-w-md">
      <label htmlFor="discogs-folder" className="text-muted">
        Folder
      </label>
      <select
        id="discogs-folder"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="min-w-0 flex-1 rounded-control border border-line bg-raised px-3 py-1.5 text-ink focus:border-accent focus:outline-hidden"
      >
        {sorted.map((folder) => (
          <option key={folder.id} value={folder.id}>
            {folder.id === 0 ? "Whole collection" : folder.name} ({folder.count})
          </option>
        ))}
      </select>
    </div>
  );
}
