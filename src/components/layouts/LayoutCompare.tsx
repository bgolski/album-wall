import { useEffect, useState } from "react";
import Image from "next/image";
import type { Album, SharedWallState } from "@/types";
import { diffWalls, type WallPosition } from "@/utils/diffWalls";
import { coverSources } from "@/utils/coverSource";
import { coverAddresses, DEFAULT_PLACEHOLDER_IMAGE } from "@/utils/imageProxy";
import { orderWallSteps, type WallStep } from "@/utils/wallSteps";

interface LayoutCompareProps {
  /** The wall as it is now. */
  currentWall: SharedWallState;
  /** The saved wall being compared. */
  target: SharedWallState;
  /** The saved wall's name. */
  name: string;
  /** Albums by id, to show covers and names. */
  albumsById: Map<string, Album>;
}

const where = (position: WallPosition) => `row ${position.row}, column ${position.column}`;
const sameSpot = (a: WallPosition | null | undefined, b: WallPosition | null | undefined) =>
  Boolean(a && b && a.row === b.row && a.column === b.column);
const smallButton =
  "rounded-control bg-raised px-3 py-1 text-sm text-ink transition-colors hover:bg-line disabled:opacity-50";

type WakeLockSentinelLike = { release: () => Promise<void> };
type WakeLockLike = { request: (type: "screen") => Promise<WakeLockSentinelLike> };
const wakeLockOf = () =>
  (typeof navigator !== "undefined"
    ? (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock
    : undefined) ?? null;

/**
 * Shows how to get from the wall now to a saved wall: a small diagram of the saved wall, like a
 * calendar, with a numbered badge on every spot that changes, and the steps in an order that can
 * be followed at the real wall. Choosing a step outlines where the cover comes from and where it
 * goes; Previous and Next walk through them, and each can be ticked off.
 */
export function LayoutCompare({ currentWall, target, name, albumsById }: LayoutCompareProps) {
  const diff = diffWalls(currentWall, target);
  const steps = orderWallSteps(diff);
  const unchanged = diff.unchanged;
  const [selected, setSelected] = useState<number | null>(null);
  const [done, setDone] = useState<ReadonlySet<number>>(new Set());
  const [keepScreenOn, setKeepScreenOn] = useState(false);
  const wakeLock = wakeLockOf();

  // Keep the screen on while working at the wall; the browser drops the lock when the page is
  // hidden, so ask again when it comes back.
  useEffect(() => {
    if (!keepScreenOn || !wakeLock) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let stopped = false;
    const acquire = () => {
      wakeLock
        .request("screen")
        .then((lock) => {
          if (stopped) void lock.release();
          else sentinel = lock;
        })
        .catch(() => setKeepScreenOn(false));
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
  }, [keepScreenOn, wakeLock]);

  const albumName = (id: string) => {
    const album = albumsById.get(id);
    return album ? `${album.title} (${album.artist})` : "An album no longer in the collection";
  };
  const cover = (id: string | undefined) => {
    const album = id ? albumsById.get(id) : undefined;
    const url = album?.cover_image || album?.coverUrl;
    if (!url) return DEFAULT_PLACEHOLDER_IMAGE;
    return coverAddresses(url, coverSources(), { size: 96 })[0]!.src;
  };

  const describe = (step: WallStep) => {
    const title = albumName(step.id);
    switch (step.kind) {
      case "take-down":
        return `Take down ${title} from ${where(step.from)}`;
      case "set-aside":
        return `Set ${title} aside from ${where(step.from)} for a moment`;
      case "move":
        return step.from
          ? `Move ${title} from ${where(step.from)} to ${where(step.to)}`
          : `Hang ${title}, set aside earlier, at ${where(step.to)}`;
      case "hang-up":
        return `Hang up ${title} at ${where(step.to)}`;
    }
  };

  if (steps.length === 0) {
    return (
      <div className="mt-3 rounded-control bg-panel p-3 text-sm text-ink">
        <h4 className="mb-2 font-medium">From the wall now to &quot;{name}&quot;</h4>
        <p>Nothing to change: the wall already matches.</p>
      </div>
    );
  }

  const current = selected === null ? null : steps[selected]!;
  const sourceOf = (step: WallStep | null) =>
    step && (step.kind === "take-down" || step.kind === "set-aside" || step.kind === "move")
      ? step.from
      : null;
  const destinationOf = (step: WallStep | null) =>
    step && (step.kind === "move" || step.kind === "hang-up") ? step.to : null;
  // The step that ends at each spot of the saved wall, for its badge.
  const stepEndingAt = (position: WallPosition) =>
    steps.findIndex((step) => sameSpot(destinationOf(step), position));
  const inGrid = (position: WallPosition | null) =>
    position !== null && position.row <= target.rows && position.column <= target.columns;

  const from = sourceOf(current);
  const to = destinationOf(current);
  const arrow = inGrid(from) && inGrid(to) ? { from: from!, to: to! } : null;
  const toggleDone = (index: number) =>
    setDone((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const cells = Array.from({ length: target.rows * target.columns }, (_, index) => {
    const position = {
      row: Math.floor(index / target.columns) + 1,
      column: (index % target.columns) + 1,
    };
    const id = target.wallAlbumIds[index];
    const stepIndex = stepEndingAt(position);
    return { index, position, id, stepIndex };
  });
  const takeDowns = steps
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => step.kind === "take-down" || step.kind === "set-aside");

  return (
    <div className="mt-3 rounded-control bg-panel p-3 text-sm text-ink">
      <h4 className="mb-2 font-medium">From the wall now to &quot;{name}&quot;</h4>

      <div className="sticky top-0 z-10 -mx-3 bg-panel px-3 pb-2 pt-1">
        <div className="relative mx-auto max-w-md">
          <div
            role="group"
            aria-label={`Diagram of "${name}"`}
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${target.columns}, minmax(0, 1fr))` }}
          >
            {cells.map(({ index, position, id, stepIndex }) => {
              const state = sameSpot(to, position)
                ? "destination"
                : sameSpot(from, position)
                  ? "source"
                  : stepIndex >= 0
                    ? "changes"
                    : "stays";
              const label = id
                ? `${where(position)}: ${albumName(id)}${stepIndex >= 0 ? `, step ${stepIndex + 1}` : ", stays"}`
                : `${where(position)}: empty`;
              return (
                <button
                  key={index}
                  type="button"
                  aria-label={label}
                  aria-current={state === "destination" ? "step" : undefined}
                  data-state={state}
                  onClick={() => stepIndex >= 0 && setSelected(stepIndex)}
                  className={`relative aspect-square overflow-hidden rounded-sm bg-raised ${
                    state === "destination"
                      ? "ring-4 ring-accent"
                      : state === "source"
                        ? "outline-dashed outline-2 outline-offset-1 outline-ink"
                        : ""
                  } ${state === "stays" ? "opacity-40" : ""}`}
                >
                  <Image
                    src={cover(id)}
                    alt=""
                    fill
                    sizes="48px"
                    className="object-cover"
                    loading="eager"
                    unoptimized
                  />
                  {stepIndex >= 0 && (
                    <span
                      className={`absolute left-0.5 top-0.5 min-w-[1rem] rounded-full px-1 text-[10px] font-bold leading-4 ${
                        done.has(stepIndex)
                          ? "bg-raised text-muted line-through"
                          : "bg-accent text-on-accent"
                      }`}
                    >
                      {stepIndex + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {arrow && (
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox={`0 0 ${target.columns} ${target.rows}`}
              preserveAspectRatio="none"
            >
              <defs>
                <marker
                  id="wall-arrow"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto"
                >
                  <path d="M0,0 L10,5 L0,10 z" className="fill-accent" />
                </marker>
              </defs>
              <line
                x1={arrow.from.column - 0.5}
                y1={arrow.from.row - 0.5}
                x2={arrow.to.column - 0.5}
                y2={arrow.to.row - 0.5}
                className="stroke-accent"
                strokeWidth={0.08}
                markerEnd="url(#wall-arrow)"
              />
            </svg>
          )}
        </div>

        {takeDowns.length > 0 && (
          <div className="mx-auto mt-2 max-w-md">
            <p className="text-xs text-muted">Coming down</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {takeDowns.map(({ step, index }) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`Step ${index + 1}: ${describe(step)}`}
                  aria-current={selected === index ? "step" : undefined}
                  onClick={() => setSelected(index)}
                  className={`relative h-10 w-10 overflow-hidden rounded-sm bg-raised ${selected === index ? "ring-4 ring-accent" : ""}`}
                >
                  <Image
                    src={cover(step.id)}
                    alt=""
                    fill
                    sizes="40px"
                    className="object-cover"
                    loading="eager"
                    unoptimized
                  />
                  <span className="absolute left-0.5 top-0.5 rounded-full bg-raised px-1 text-[10px] font-bold leading-4 text-ink">
                    {index + 1}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mx-auto mt-2 flex max-w-md flex-wrap items-center gap-2">
          <button
            type="button"
            className={smallButton}
            disabled={selected === 0}
            onClick={() => setSelected(selected === null ? 0 : Math.max(0, selected - 1))}
          >
            Previous
          </button>
          <button
            type="button"
            className={smallButton}
            disabled={selected === steps.length - 1}
            onClick={() =>
              setSelected(selected === null ? 0 : Math.min(steps.length - 1, selected + 1))
            }
          >
            {selected === null ? "Start" : "Next"}
          </button>
          <span className="text-xs text-muted">
            {selected === null
              ? `${steps.length} steps`
              : `Step ${selected + 1} of ${steps.length}`}
            {done.size > 0 && `, ${done.size} done`}
          </span>
          {wakeLock && (
            <label className="ml-auto flex items-center gap-1 text-xs text-ink">
              <input
                type="checkbox"
                checked={keepScreenOn}
                onChange={(event) => setKeepScreenOn(event.target.checked)}
              />
              Keep screen on
            </label>
          )}
        </div>
        {current && (
          <p role="status" className="mx-auto mt-2 max-w-md font-medium">
            {selected! + 1}. {describe(current)}
          </p>
        )}
      </div>

      <ol className="mt-2 flex flex-col gap-1" aria-label="Steps">
        {steps.map((step, index) => (
          <li
            key={index}
            className={`flex items-start gap-2 rounded-control px-2 py-1 ${selected === index ? "bg-raised" : ""}`}
          >
            <input
              type="checkbox"
              aria-label={`Step ${index + 1} done`}
              checked={done.has(index)}
              onChange={() => toggleDone(index)}
              className="mt-1"
            />
            <button
              type="button"
              aria-current={selected === index ? "step" : undefined}
              onClick={() => setSelected(index)}
              className={`text-left ${done.has(index) ? "text-muted line-through" : ""}`}
            >
              {index + 1}. {describe(step)}
            </button>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-muted">
        {unchanged} {unchanged === 1 ? "album stays" : "albums stay"} where
        {unchanged === 1 ? " it is" : " they are"}.
      </p>
    </div>
  );
}
