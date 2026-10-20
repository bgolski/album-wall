import { useEffect, useState } from "react";
import Image from "next/image";
import type { Album, SharedWallState } from "@/types";
import { diffWalls, type WallPosition } from "@/utils/diffWalls";
import { coverSources } from "@/utils/coverSource";
import { coverAddresses, DEFAULT_PLACEHOLDER_IMAGE } from "@/utils/imageProxy";
import { rehangSteps, type RehangStep } from "@/utils/rehangSteps";

interface RehangProps {
  /** The wall as it is now. */
  currentWall: SharedWallState;
  /** The saved wall to hang. */
  target: SharedWallState;
  /** The saved wall's name. */
  name: string;
  /** Albums by id, to show covers and titles. */
  albumsById: Map<string, Album>;
  /** Leaves the guide without finishing. */
  onCancel: () => void;
  /** Called when the last step is done: the real wall is now the saved wall. */
  onFinish: () => void;
}

const COVER_SIZE = 112;
const button =
  "rounded-control bg-raised px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-line disabled:opacity-40";

type WakeLockSentinelLike = { release: () => Promise<void> };
type WakeLockLike = { request: (type: "screen") => Promise<WakeLockSentinelLike> };
const wakeLockOf = () =>
  (typeof navigator !== "undefined"
    ? (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock
    : undefined) ?? null;

const where = (position: WallPosition) => `row ${position.row}, column ${position.column}`;
const sameSpot = (a: WallPosition | null | undefined, b: WallPosition | null | undefined) =>
  Boolean(a && b && a.row === b.row && a.column === b.column);

const VERBS: Record<RehangStep["kind"], string> = {
  "take-down": "Take down",
  "set-aside": "Set aside",
  move: "Move",
  "hang-up": "Hang up",
  replace: "Replace",
};

/** Where on the wall a step starts (a cover comes off) and ends (a cover goes up). */
function spotsOf(step: RehangStep): { from: WallPosition | null; to: WallPosition | null } {
  switch (step.kind) {
    case "take-down":
    case "set-aside":
      return { from: step.from, to: null };
    case "move":
      return { from: step.from, to: step.to };
    case "hang-up":
      return { from: null, to: step.to };
    case "replace":
      return { from: step.at, to: step.at };
  }
}

/**
 * Hangs a saved wall one step at a time, at the real wall: the cover to handle, a small picture
 * of the wall with the spot lit up, and Done for the next step. Steps already done tint their
 * spots, so progress shows without a list. The screen stays on while it is open, and the last
 * Done finishes the job. Closing the panel leaves the guide.
 */
export function Rehang({ currentWall, target, name, albumsById, onCancel, onFinish }: RehangProps) {
  const steps = rehangSteps(diffWalls(currentWall, target));
  const [at, setAt] = useState(0);
  const wakeLock = wakeLockOf();

  // Escape leaves the guide (and only the guide, not the panel around it).
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onCancel();
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [onCancel]);

  // Keep the screen on while working at the wall; the browser drops the lock when the page is
  // hidden, so ask again when it comes back.
  useEffect(() => {
    if (!wakeLock) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let stopped = false;
    const acquire = () => {
      wakeLock
        .request("screen")
        .then((lock) => {
          if (stopped) void lock.release();
          else sentinel = lock;
        })
        .catch(() => undefined);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") acquire();
    };
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release();
    };
  }, [wakeLock]);

  const album = (id: string) => albumsById.get(id);
  const titleOf = (id: string) => album(id)?.title || "An album no longer in the collection";
  const cover = (id: string) => {
    const url = album(id)?.cover_image || album(id)?.coverUrl;
    if (!url) return DEFAULT_PLACEHOLDER_IMAGE;
    return coverAddresses(url, coverSources(), { size: COVER_SIZE })[0]!.src;
  };

  const step = steps[at]!;
  const now = spotsOf(step);

  // Spots already dealt with show as done.
  const doneSpots = new Set<string>();
  steps.slice(0, at).forEach((earlier) => {
    const { from, to } = spotsOf(earlier);
    for (const position of [to ?? from]) {
      if (position) doneSpots.add(`${position.row},${position.column}`);
    }
  });

  // The cover this step is about, and for a replace the one it takes down too.
  const covers: string[] = step.kind === "replace" ? [step.outId, step.id] : [step.id];

  const sentence = (current: RehangStep) => {
    const title = titleOf(current.kind === "replace" ? current.outId : current.id);
    const { from, to } = spotsOf(current);
    switch (current.kind) {
      case "take-down":
      case "set-aside":
        return `${VERBS[current.kind]} ${title} from ${where(from!)}`;
      case "move":
        return current.from
          ? `Move ${title} from ${where(current.from)} to ${where(current.to)}`
          : `Hang ${title}, set aside earlier, at ${where(current.to)}`;
      case "hang-up":
        return `Hang up ${title} at ${where(to!)}`;
      case "replace":
        return `Replace ${title} with ${titleOf(current.id)} at ${where(current.at)}`;
    }
  };

  return (
    <div
      role="group"
      aria-label={`Hang ${name}`}
      className="mt-3 rounded-control bg-panel p-3 text-ink"
    >
      <div className="flex items-center gap-3">
        <div
          role="progressbar"
          aria-label="Progress"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={at + 1}
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised"
        >
          <div
            className="h-full bg-accent"
            style={{ width: `${((at + 1) / steps.length) * 100}%` }}
          />
        </div>
        <span className="text-xs text-muted">
          {at + 1} / {steps.length}
        </span>
        <button
          type="button"
          aria-label="Cancel"
          title="Cancel"
          onClick={onCancel}
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-raised hover:text-ink"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <p className="mt-3 text-lg font-semibold">{VERBS[step.kind]}</p>
      <p role="status" className="sr-only">
        {sentence(step)}
      </p>
      <div className="mt-2">
        <div className="flex items-start gap-2">
          {covers.map((id, index) => (
            <div key={id} className="flex items-start gap-2">
              {index > 0 && (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-11 h-5 w-5 shrink-0 text-muted"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              )}
              <div className="w-28">
                <div className="relative aspect-square overflow-hidden rounded-control bg-raised">
                  <Image
                    src={cover(id)}
                    alt=""
                    fill
                    sizes="112px"
                    className="object-cover"
                    loading="eager"
                    unoptimized
                  />
                </div>
                <p className="mt-1 truncate text-sm font-medium">{titleOf(id)}</p>
                <p className="truncate text-xs text-muted">{album(id)?.artist ?? ""}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={button}
            disabled={at === 0}
            onClick={() => setAt(at - 1)}
          >
            Back
          </button>
          <button
            type="button"
            className="rounded-control bg-accent px-6 py-2 text-sm font-medium text-on-accent hover:bg-accent-hover"
            onClick={() => (at + 1 >= steps.length ? onFinish() : setAt(at + 1))}
          >
            Done
          </button>
        </div>
        <div
          aria-hidden="true"
          className="grid w-24 shrink-0 gap-0.5"
          style={{ gridTemplateColumns: `repeat(${target.columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: target.rows * target.columns }, (_, index) => {
            const position = {
              row: Math.floor(index / target.columns) + 1,
              column: (index % target.columns) + 1,
            };
            const here = sameSpot(now.to, position);
            const source = sameSpot(now.from, position);
            const finishedSpot = doneSpots.has(`${position.row},${position.column}`);
            return (
              <span
                key={index}
                className={`aspect-square rounded-[2px] ${
                  here
                    ? "bg-accent"
                    : source
                      ? "outline-dashed outline-2 -outline-offset-2 outline-ink"
                      : finishedSpot
                        ? "bg-accent/30"
                        : "bg-raised"
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
