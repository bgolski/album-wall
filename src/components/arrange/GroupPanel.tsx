import type { GroupChoice, GroupMode, GroupSettings } from "./groupModes";

/** What a build did, for the notice. */
export interface GroupBuildSummary {
  /** Spots filled with other records because the chosen groups ran out. */
  others: number;
}

interface GroupChoicesProps {
  mode: GroupMode;
  /** Every group in the collection (artists, genres and styles, or decades) with its size. */
  choices: GroupChoice[];
  onBuild: (settings: GroupSettings) => GroupBuildSummary;
  /** Shows a short message that goes away on its own. */
  onNotice: (message: string) => void;
}

const MAX_CHOICES = 8;
// An artist needs this many records to make a wall worth building.
const MIN_ARTIST_RECORDS = 2;
const chipClass =
  "rounded-control bg-raised px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-line";

const LABELS: Record<GroupMode, string> = {
  artist: "Arrange by artist",
  genre: "Arrange by genre",
  year: "Arrange by year",
};

/**
 * Describes a build in plain words.
 *
 * @param summary What the build did.
 * @returns A short notice.
 */
export function describeGroupBuild(summary: GroupBuildSummary): string {
  return summary.others > 0
    ? `Wall built, ${summary.others} ${summary.others === 1 ? "spot" : "spots"} filled with other records`
    : "Wall built";
}

/**
 * A row of choices under the Arrange buttons that builds a wall in one tap: an artist, a genre or
 * style, a decade, or all of them in order. It sits in the toolbar rather than beside the wall,
 * so the wall keeps its width. There is nothing to set first.
 */
export function GroupChoices({ mode, choices, onBuild, onNotice }: GroupChoicesProps) {
  const all = choices.map((choice) => choice.label);
  const build = (settings: Omit<GroupSettings, "mode">) =>
    onNotice(describeGroupBuild(onBuild({ mode, ...settings })));
  const some = (groups: string[]) => build({ groups, aToZ: false });

  const options: { name: string; apply: () => void }[] =
    mode === "year"
      ? [
          { name: "Oldest first", apply: () => some(all) },
          { name: "Newest first", apply: () => some([...all].reverse()) },
          ...choices.map((choice) => ({ name: choice.label, apply: () => some([choice.label]) })),
        ]
      : mode === "genre"
        ? [
            { name: "All genres", apply: () => some(all) },
            ...choices
              .slice(0, MAX_CHOICES)
              .map((choice) => ({ name: choice.label, apply: () => some([choice.label]) })),
          ]
        : [
            { name: "A to Z", apply: () => build({ groups: [], aToZ: true }) },
            ...choices
              .filter((choice) => choice.count >= MIN_ARTIST_RECORDS)
              .slice(0, MAX_CHOICES)
              .map((choice) => ({ name: choice.label, apply: () => some([choice.label]) })),
          ];

  return (
    <div
      role="group"
      aria-label={LABELS[mode]}
      className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3"
    >
      {options.map((option) => (
        <button key={option.name} type="button" className={chipClass} onClick={option.apply}>
          {option.name}
        </button>
      ))}
    </div>
  );
}
