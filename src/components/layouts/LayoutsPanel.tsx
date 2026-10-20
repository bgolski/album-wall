import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import type { Album, SharedWallState } from "@/types";
import { useLayouts } from "@/hooks/useLayouts";
import type { useHangHistory } from "@/hooks/useHangHistory";
import { wallDisplayName } from "@/utils/demoCollection";
import type { SavedLayout } from "@/utils/layoutStore";
import { buildSharedWallUrl } from "@/utils/shareState";
import { Rehang } from "./Rehang";
import { diffWalls } from "@/utils/diffWalls";
import { rehangSteps } from "@/utils/rehangSteps";
import { WallPreview } from "./WallPreview";
import { sameWall } from "@/utils/sameWall";
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

interface MenuItem {
  label: string;
  onSelect: () => void;
  /** Shows a tick: the item states something that is already so. */
  checked?: boolean;
}

// Height a menu needs below its button to open downward, in pixels (about four items).
const MENU_ROOM = 200;

/**
 * A small "more" menu: a button with three dots that opens a short list of actions. The list is
 * drawn over the page, outside the panel, so a panel that scrolls never cuts it off; it opens
 * upward when there is little room below.
 *
 * @param props.label What the button is called for a screen reader.
 * @param props.items The actions, in order.
 */
function MoreMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [place, setPlace] = useState<{ right: number; top?: number; bottom?: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const open = place !== null;

  useEffect(() => {
    if (!open) return;
    const close = () => setPlace(null);
    const handlePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      close();
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKeyDown, true);
    // The list is placed where the button was, so any scrolling or resizing closes it.
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  const toggle = () => {
    if (open) return setPlace(null);
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const right = window.innerWidth - rect.right;
    setPlace(
      window.innerHeight - rect.bottom < MENU_ROOM
        ? { right, bottom: window.innerHeight - rect.top + 4 }
        : { right, top: rect.bottom + 4 }
    );
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        className="flex h-8 w-8 items-center justify-center rounded-control bg-raised text-ink hover:bg-line"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {place &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={label}
            style={place}
            className="fixed z-50 min-w-44 rounded-panel border border-line bg-panel p-1 shadow-xl"
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setPlace(null);
                  item.onSelect();
                }}
                className="block w-full rounded-control px-3 py-2 text-left text-sm text-ink hover:bg-raised"
              >
                {item.label}
                {item.checked && (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="ml-2 inline h-3 w-3 text-accent"
                  >
                    <path d="M3.5 8.5l3 3 6-7" />
                  </svg>
                )}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}

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
  // The saved wall last put on the wall with Use. A wall just saved is not selected.
  const [used, setUsed] = useState<string | null>(null);
  const nameId = useId();
  const importId = useId();
  const importRef = useRef<HTMLInputElement | null>(null);

  if (!isVisible) return null;

  const albumsById = new Map(albums.map((album) => [String(album.id), album]));

  // The saved wall most recently marked as on the real wall.
  const onWallId = history?.hangs[history.hangs.length - 1]?.layoutId;

  const markOnWall = (layout: SavedLayout) => {
    if (!history) return;
    const problem = history.markHung(layout.wall.wallAlbumIds, layout.id);
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
    const missing = layout.wall.wallAlbumIds.filter((id) => !albumsById.has(id)).length;
    onApply(layout.wall);
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
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `album-wall-layouts-${wallDisplayName(collectionName)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
                            aria-label={`Put ${layout.name} on the wall`}
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
    </section>
  );
}
