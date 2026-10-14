import { useId, useState, type FormEvent } from "react";
import { wallSize } from "@/utils/wallSize";
import type { Album, SharedWallState } from "@/types";
import { useLayouts } from "@/hooks/useLayouts";
import type { useHangHistory } from "@/hooks/useHangHistory";
import { formatDay } from "@/utils/hangHistory";
import { wallDisplayName } from "@/utils/demoCollection";
import type { SavedLayout } from "@/utils/layoutStore";
import { buildSharedWallUrl } from "@/utils/shareState";
import { LayoutCompare } from "./LayoutCompare";
import { copyLink } from "@/utils/copyText";

interface LayoutsPanelProps {
  isVisible: boolean;
  /** Collection the layouts belong to (the Discogs username, or the demo's name). */
  collectionName: string;
  /** The wall as it is now. */
  currentWall: SharedWallState;
  /** Every album in the collection, to name the albums in a comparison. */
  albums: Album[];
  /** Puts a saved wall on the wall. */
  onApply: (wall: SharedWallState) => void;
  /** Options passed to the layout storage, for tests. */
  storageOptions?: Parameters<typeof useLayouts>[1];
  /** Which walls were hung and when; included in backups. */
  history?: ReturnType<typeof useHangHistory>;
}

const buttonClass =
  "rounded-control bg-raised px-3 py-1 text-sm text-ink transition-colors hover:bg-line";
// The panel sits on the raised background, so its own buttons use the panel color to stand out.
const panelButtonClass =
  "rounded-control bg-panel px-3 py-1 text-sm text-ink transition-colors hover:bg-line disabled:opacity-50";

/**
 * Saves the wall under a name, puts a saved wall back, lists what would change on the physical
 * wall to get from the current wall to a saved one, and backs layouts up to a file. Layouts live
 * in this browser only; the panel says so and offers the backup.
 */
export function LayoutsPanel({
  isVisible,
  collectionName,
  currentWall,
  albums,
  onApply,
  storageOptions,
  history,
}: LayoutsPanelProps) {
  const { layouts, save, rename, remove, importText, exportText, needsBackup } = useLayouts(
    collectionName,
    { ...storageOptions, ...(history ? { history } : {}) }
  );
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [comparing, setComparing] = useState<string | null>(null);
  const [undoWall, setUndoWall] = useState<SharedWallState | null>(null);
  const nameId = useId();
  const importId = useId();

  if (!isVisible) return null;

  const albumsById = new Map(albums.map((album) => [String(album.id), album]));

  const handleSave = (event: FormEvent) => {
    event.preventDefault();
    const problem = save(name, currentWall);
    setMessage(problem ?? `Saved "${name.trim()}".`);
    if (!problem) setName("");
  };

  const handleApply = (layout: SavedLayout) => {
    const missing = layout.wall.wallAlbumIds.filter((id) => !albumsById.has(id)).length;
    setUndoWall(currentWall);
    onApply(layout.wall);
    setMessage(
      missing > 0
        ? `Put "${layout.name}" on the wall. ${missing} of its albums are no longer in the collection.`
        : `Put "${layout.name}" on the wall.`
    );
  };

  const handleUndoApply = () => {
    if (!undoWall) return;
    onApply(undoWall);
    setUndoWall(null);
    setMessage("Put the previous wall back.");
  };

  const handleCopyLink = async (layout: SavedLayout) => {
    const link = buildSharedWallUrl(
      { ...layout.wall, username: collectionName },
      window.location.href
    );
    const outcome = await copyLink(link);
    setMessage(
      outcome === "copied"
        ? `Copied a link to "${layout.name}".`
        : `Copy the link to "${layout.name}" from the box.`
    );
  };

  const handleExport = () => {
    const blob = new Blob([exportText()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `album-wall-layouts-${wallDisplayName(collectionName)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Saved a backup file of your layouts.");
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    setMessage(importText(await file.text()).message);
  };

  const compared = layouts.find((layout) => layout.id === comparing);

  return (
    <section aria-labelledby={`${nameId}-heading`} className="mt-3 rounded-control bg-raised p-3">
      <h3 id={`${nameId}-heading`} className="mb-1 font-medium text-ink">
        Layouts
      </h3>
      <p className="mb-3 text-sm text-muted">
        Layouts are kept in this browser only.
        {needsBackup && " Some are not backed up yet: save a backup file to keep a copy."}
      </p>

      <form onSubmit={handleSave} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor={nameId} className="text-sm text-ink">
            Name for the current wall
          </label>
          <input
            id={nameId}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={60}
            className="rounded-control border border-line bg-panel px-3 py-2 text-ink"
          />
        </div>
        <button
          type="submit"
          className="rounded-control bg-accent px-3 py-2 text-sm font-medium text-on-accent hover:bg-accent-hover"
        >
          Save current wall
        </button>
      </form>

      {message && (
        <p role="status" className="mt-3 text-sm text-ink">
          {message}{" "}
          {undoWall && (
            <button type="button" onClick={handleUndoApply} className={buttonClass}>
              Undo
            </button>
          )}
        </p>
      )}

      {layouts.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2" aria-label="Saved layouts">
          {layouts.map((layout) => (
            <li key={layout.id} className="rounded-control bg-panel p-3">
              {renaming?.id === layout.id ? (
                <form
                  className="flex flex-col gap-2 sm:flex-row"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const problem = rename(layout.id, renaming.value);
                    setMessage(problem);
                    if (!problem) setRenaming(null);
                  }}
                >
                  <label className="sr-only" htmlFor={`${nameId}-${layout.id}`}>
                    New name for {layout.name}
                  </label>
                  <input
                    id={`${nameId}-${layout.id}`}
                    value={renaming.value}
                    onChange={(event) => setRenaming({ id: layout.id, value: event.target.value })}
                    maxLength={60}
                    className="flex-1 rounded-control border border-line bg-panel px-3 py-1 text-ink"
                  />
                  <button type="submit" className={buttonClass}>
                    Save name
                  </button>
                  <button type="button" className={buttonClass} onClick={() => setRenaming(null)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium text-ink">{layout.name}</p>
                    <p className="text-xs text-muted">
                      {wallSize(layout.wall.columns, layout.wall.rows)} wall, saved{" "}
                      {new Date(layout.savedAt).toLocaleDateString()}
                    </p>
                  </div>
                  {confirmingDelete === layout.id ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm text-ink">
                      Delete &quot;{layout.name}&quot;?
                      <button
                        type="button"
                        className={buttonClass}
                        onClick={() => {
                          setMessage(remove(layout.id) ?? `Deleted "${layout.name}".`);
                          setConfirmingDelete(null);
                          if (comparing === layout.id) setComparing(null);
                        }}
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        className={buttonClass}
                        onClick={() => setConfirmingDelete(null)}
                      >
                        Keep
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={buttonClass}
                        aria-label={`Put ${layout.name} on the wall`}
                        onClick={() => handleApply(layout)}
                      >
                        Put on wall
                      </button>
                      <button
                        type="button"
                        className={buttonClass}
                        aria-label={`Compare ${layout.name} with the wall`}
                        aria-pressed={comparing === layout.id}
                        onClick={() => setComparing(comparing === layout.id ? null : layout.id)}
                      >
                        Compare
                      </button>
                      <button
                        type="button"
                        className={buttonClass}
                        aria-label={`Copy a link to ${layout.name}`}
                        onClick={() => void handleCopyLink(layout)}
                      >
                        Copy link
                      </button>
                      <button
                        type="button"
                        className={buttonClass}
                        aria-label={`Rename ${layout.name}`}
                        onClick={() => setRenaming({ id: layout.id, value: layout.name })}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className={buttonClass}
                        aria-label={`Delete ${layout.name}`}
                        onClick={() => setConfirmingDelete(layout.id)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {compared && (
        <LayoutCompare
          key={compared.id}
          currentWall={currentWall}
          target={compared.wall}
          name={compared.name}
          albumsById={albumsById}
        />
      )}

      {history && (
        <div className="mt-4 border-t border-line pt-3">
          <h4 className="mb-1 text-sm font-medium text-ink">Wall history</h4>
          <p className="mb-2 text-sm text-muted">
            {history.hangs.length === 0
              ? "Mark the wall when you hang it, to see which records have not been up in a while."
              : `Last hung ${formatDay(history.hangs[history.hangs.length - 1]!.date)}, ${
                  history.hangs[history.hangs.length - 1]!.albumIds.length
                } records. ${history.hangs.length} ${
                  history.hangs.length === 1 ? "wall" : "walls"
                } remembered.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={panelButtonClass}
              onClick={() => {
                const problem = history.markHung(currentWall.wallAlbumIds);
                setMessage(problem ?? "Marked the current wall as hung today.");
              }}
            >
              I hung the current wall
            </button>
            {history.hangs.length > 0 &&
              (confirmingClear ? (
                <button
                  type="button"
                  className={panelButtonClass}
                  onClick={() => {
                    setConfirmingClear(false);
                    setMessage(history.clear() ?? "Cleared the wall history.");
                  }}
                >
                  Clear all history?
                </button>
              ) : (
                <button
                  type="button"
                  className={panelButtonClass}
                  onClick={() => setConfirmingClear(true)}
                >
                  Clear history
                </button>
              ))}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={panelButtonClass}
          onClick={handleExport}
          disabled={layouts.length === 0 && (history?.hangs.length ?? 0) === 0}
        >
          Save backup file
        </button>
        <label htmlFor={importId} className={`${panelButtonClass} cursor-pointer`}>
          Load backup file
        </label>
        <input
          id={importId}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(event) => {
            void handleImport(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
    </section>
  );
}
