import { useId, useRef, useState, type FormEvent } from "react";
import { downloadBlob } from "@/utils/download";
import { MoreMenu } from "../ui/MoreMenu";
import type { MenuItem } from "../ui/MoreMenu";
import type { Album, SharedWallState } from "@/types";
import { useLayouts } from "@/hooks/useLayouts";
import type { useHangHistory } from "@/hooks/useHangHistory";
import { wallDisplayName } from "@/collection/demoCollection";
import type { SavedLayout } from "@/wall/layoutStore";
import { buildSharedWallUrl } from "@/share/shareState";
import { albumKey } from "@/wall/albumKey";
import { formatDay, type HangRecord, wallOfHang, countMissing } from "@/wall/hangHistory";
import { Rehang } from "./Rehang";
import { diffWalls } from "@/wall/diffWalls";
import { rehangSteps } from "@/wall/rehangSteps";
import { WallPreview } from "./WallPreview";
import { sameWall } from "@/wall/sameWall";
import { copyLink } from "@/utils/copyText";

interface LayoutsPanelProps {
  isVisible: boolean;
  /** Collection the saved walls belong to (the Discogs username, or the demo's name). */
  collectionName: string;
  /** The wall as it is now. */
  currentWall: SharedWallState;
  /** Every album in the collection, to name the albums in a comparison. */
  albums: Album[];
  /** Puts a saved wall on the wall. */
  onApply: (wall: SharedWallState) => void;
  /** Options passed to the saved wall storage, for tests. */
  storageOptions?: Parameters<typeof useLayouts>[1];
  /** Which walls were hung and when; included in backups. */
  history?: ReturnType<typeof useHangHistory>;
  /** Shows a short message that goes away on its own. */
  onNotice: (message: string) => void;
}

const buttonClass =
  "rounded-control bg-raised px-3 py-1 text-sm text-ink transition-colors hover:bg-line";

/**
 * Saved walls: name the wall as it is now and save it, then use any saved wall to put it back on
 * the wall. Each saved wall has a menu to rehang it (a guide, one step at a time, to hang it at
 * the real wall), copy a link to it, rename it, mark it as the one on your real wall (which is what
 * remembers when each record was last up), or delete it. A menu at the top saves or loads a
 * backup file. Walls live in this browser, or in the account when signed in.
 */
export function LayoutsPanel({
  isVisible,
  collectionName,
  currentWall,
  albums,
  onApply,
  storageOptions,
  history,
  onNotice,
}: LayoutsPanelProps) {
  const { layouts, saveLayout, rename, remove, importText, exportText } = useLayouts(
    collectionName,
    { ...storageOptions, ...(history ? { history } : {}) }
  );
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  // The saved wall being hung at the real wall, and the wall the steps start from.
  const [rehanging, setRehanging] = useState<{ id: string; from: SharedWallState } | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  // The earlier wall (by its day) whose picture is showing.
  const [lookingAt, setLookingAt] = useState<string | null>(null);
  // The saved wall last put on the wall with Use. A wall just saved is not selected.
  const [used, setUsed] = useState<string | null>(null);
  const nameId = useId();
  const importId = useId();
  const importRef = useRef<HTMLInputElement | null>(null);

  if (!isVisible) return null;

  const albumsById = new Map(albums.map((album) => [albumKey(album), album]));

  // The saved wall most recently marked as on the real wall.
  const onWallId = history?.hangs[history.hangs.length - 1]?.layoutId;

  const markOnWall = (layout: SavedLayout) => {
    if (!history) return;
    const problem = history.markHung(layout.wall.wallAlbumIds, layout.id, {
      rows: layout.wall.rows,
      columns: layout.wall.columns,
    });
    if (problem) onNotice(problem);
  };

  const handleSave = (event: FormEvent) => {
    event.preventDefault();
    // A blank name is fine: the wall is called "Wall 1", "Wall 2" and so on.
    const { problem, layout } = saveLayout(
      name.trim() || `Wall ${layouts.length + 1}`,
      currentWall
    );
    if (problem !== null) {
      onNotice(problem);
      return;
    }
    setName("");
    onNotice(`Saved ${layout.name}`);
  };

  // Using a saved wall is one change to the wall, so the toolbar's Undo puts the old one back.
  const handleApply = (layout: SavedLayout) => {
    setUsed(layout.id);
    const missing = countMissing(layout.wall.wallAlbumIds, albumsById);
    onApply(layout.wall);
    if (missing > 0) onNotice(`${missing} no longer in the collection`);
  };

  // An earlier wall as a wall that can be put back. A record from before the shape was kept takes
  // it from the saved wall it came from, or from the wall as it is now.
  const wallOfHangHere = (hang: HangRecord): SharedWallState => {
    const saved = hang.layoutId ? layouts.find((layout) => layout.id === hang.layoutId) : undefined;
    return wallOfHang(hang, collectionName, saved?.wall.columns ?? currentWall.columns);
  };

  const handleUseHang = (hang: HangRecord) => {
    setUsed(null);
    const missing = countMissing(hang.albumIds, albumsById);
    onApply(wallOfHangHere(hang));
    if (missing > 0) onNotice(`${missing} no longer in the collection`);
  };

  const handleCopyLink = async (layout: SavedLayout) => {
    const link = buildSharedWallUrl(
      { ...layout.wall, username: collectionName },
      window.location.href
    );
    const outcome = await copyLink(link);
    onNotice(outcome === "copied" ? "Link copied" : "Could not copy");
  };

  const handleExport = () => {
    const blob = new Blob([exportText()], { type: "application/json" });
    downloadBlob(blob, `album-wall-layouts-${wallDisplayName(collectionName)}.json`);
    onNotice("Backup saved");
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    onNotice(importText(await file.text()).message);
  };

  const rehung = layouts.find((layout) => layout.id === rehanging?.id);

  // Hanging a saved wall takes over the panel: nothing else is on screen while it is followed.
  if (rehanging && rehung) {
    return (
      <section aria-label="Saved walls" className="pr-8">
        <Rehang
          key={rehung.id}
          currentWall={rehanging.from}
          target={rehung.wall}
          name={rehung.name}
          albumsById={albumsById}
          onCancel={() => setRehanging(null)}
          onFinish={() => {
            // The real wall is now this saved wall: so is the wall on screen, and it counts as
            // hung. The toolbar's Undo puts the screen back.
            handleApply(rehung);
            markOnWall(rehung);
            setRehanging(null);
            onNotice("Done");
          }}
        />
      </section>
    );
  }
  const hasAnything = layouts.length > 0 || (history?.hangs.length ?? 0) > 0;

  const backupItems: MenuItem[] = [
    ...(hasAnything ? [{ label: "Save backup file", onSelect: handleExport }] : []),
    { label: "Load backup file", onSelect: () => importRef.current?.click() },
  ];

  return (
    <section aria-labelledby={`${nameId}-heading`} className="pr-8">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 id={`${nameId}-heading`} className="font-medium text-ink">
          Saved walls
        </h3>
        <MoreMenu label="Backup" items={backupItems} />
        <label htmlFor={importId} className="sr-only">
          Load backup file
        </label>
        <input
          id={importId}
          ref={importRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            void handleImport(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>

      <form onSubmit={handleSave} className="flex items-center gap-2">
        <label htmlFor={nameId} className="sr-only">
          Name for the current wall
        </label>
        <input
          id={nameId}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={60}
          placeholder="Name"
          className="min-w-0 flex-1 rounded-control border border-line bg-panel px-3 py-2 text-ink placeholder:text-muted"
        />
        <button
          type="submit"
          className="shrink-0 rounded-control bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-hover"
        >
          Save
        </button>
      </form>

      {layouts.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2" aria-label="Saved walls">
          {layouts.map((layout) => {
            // Showing now: the wall is this saved wall exactly; changing anything ends that.
            const current = used === layout.id && sameWall(currentWall, layout.wall);
            const menu: MenuItem[] = [
              {
                label: "Rehang",
                onSelect: () => {
                  if (rehangSteps(diffWalls(currentWall, layout.wall)).length === 0) {
                    onNotice("Already matches");
                    return;
                  }
                  setRehanging({ id: layout.id, from: currentWall });
                },
              },
              { label: "Copy link", onSelect: () => void handleCopyLink(layout) },
              {
                label: "Rename",
                onSelect: () => setRenaming({ id: layout.id, value: layout.name }),
              },
              ...(history
                ? [
                    onWallId === layout.id
                      ? { label: "On my wall", onSelect: () => undefined, checked: true }
                      : { label: "Mark as on my wall", onSelect: () => markOnWall(layout) },
                  ]
                : []),
              { label: "Delete", onSelect: () => setConfirmingDelete(layout.id) },
            ];
            return (
              <li
                key={layout.id}
                className={`rounded-control bg-panel p-3 ${
                  current || previewing === layout.id ? "ring-2 ring-accent" : ""
                }`}
              >
                {renaming?.id === layout.id ? (
                  <form
                    className="flex items-center gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const problem = rename(layout.id, renaming.value);
                      if (problem) onNotice(problem);
                      else setRenaming(null);
                    }}
                  >
                    <label className="sr-only" htmlFor={`${nameId}-${layout.id}`}>
                      New name for {layout.name}
                    </label>
                    <input
                      id={`${nameId}-${layout.id}`}
                      value={renaming.value}
                      onChange={(event) =>
                        setRenaming({ id: layout.id, value: event.target.value })
                      }
                      maxLength={60}
                      className="min-w-0 flex-1 rounded-control border border-line bg-panel px-3 py-1 text-ink"
                    />
                    <button type="submit" className={buttonClass}>
                      Save
                    </button>
                    <button type="button" className={buttonClass} onClick={() => setRenaming(null)}>
                      Cancel
                    </button>
                  </form>
                ) : confirmingDelete === layout.id ? (
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate font-medium text-ink">{layout.name}</p>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        className={buttonClass}
                        onClick={() => {
                          const problem = remove(layout.id);
                          if (problem) onNotice(problem);
                          setConfirmingDelete(null);
                          if (rehanging?.id === layout.id) setRehanging(null);
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
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        aria-expanded={previewing === layout.id}
                        onClick={() => setPreviewing(previewing === layout.id ? null : layout.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left font-medium text-ink"
                      >
                        {current && (
                          <span
                            role="img"
                            aria-label="Showing now"
                            title="Showing now"
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent"
                          >
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="h-3 w-3"
                            >
                              <path d="M3.5 8.5l3 3 6-7" />
                            </svg>
                          </span>
                        )}
                        <span className="truncate">{layout.name}</span>
                      </button>
                      <div className="flex shrink-0 items-center gap-2">
                        {!current && (
                          <button
                            type="button"
                            className={buttonClass}
                            aria-label={`Use ${layout.name} on the wall`}
                            onClick={() => handleApply(layout)}
                          >
                            Use
                          </button>
                        )}
                        <MoreMenu label={`More for ${layout.name}`} items={menu} />
                      </div>
                    </div>
                    {previewing === layout.id && (
                      <WallPreview name={layout.name} wall={layout.wall} albumsById={albumsById} />
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {history && history.hangs.length > 0 && (
        <>
          <h4 className="mb-2 mt-5 text-sm font-medium text-muted">History</h4>
          <ul className="flex flex-col gap-2" aria-label="History">
            {[...history.hangs]
              .reverse()
              .slice(0, 12)
              .map((hang) => {
                const day = formatDay(hang.date);
                const savedName = hang.layoutId
                  ? layouts.find((layout) => layout.id === hang.layoutId)?.name
                  : undefined;
                return (
                  <li key={hang.date} className="rounded-control bg-panel p-3">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        aria-expanded={lookingAt === hang.date}
                        onClick={() => setLookingAt(lookingAt === hang.date ? null : hang.date)}
                        className="flex min-w-0 flex-1 items-baseline gap-2 py-1 text-left font-medium text-ink"
                      >
                        <span className="truncate">{day}</span>
                        {savedName && (
                          <span className="truncate text-sm font-normal text-muted">
                            {savedName}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        className={buttonClass}
                        aria-label={`Use the wall from ${day}`}
                        onClick={() => handleUseHang(hang)}
                      >
                        Use
                      </button>
                    </div>
                    {lookingAt === hang.date && (
                      <WallPreview name={day} wall={wallOfHangHere(hang)} albumsById={albumsById} />
                    )}
                  </li>
                );
              })}
          </ul>
        </>
      )}
    </section>
  );
}
