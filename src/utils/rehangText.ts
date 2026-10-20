import type { WallPosition } from "./diffWalls";
import type { RehangStep } from "./rehangSteps";

/**
 * One step as a sentence, such as "Replace Rumours with Nevermind at row 2, column 3".
 *
 * @param step The step.
 * @param titleOf The title to show for an album id.
 * @param where How to name a place on the wall.
 * @returns The sentence.
 */
export function stepSentence(
  step: RehangStep,
  titleOf: (id: string) => string,
  where: (position: WallPosition) => string
): string {
  const title = titleOf(step.kind === "replace" ? step.outId : step.id);
  switch (step.kind) {
    case "take-down":
      return `Take down ${title} from ${where(step.from)}`;
    case "set-aside":
      return `Set aside ${title} from ${where(step.from)}`;
    case "move":
      return step.from
        ? `Move ${title} from ${where(step.from)} to ${where(step.to)}`
        : `Hang ${title}, set aside earlier, at ${where(step.to)}`;
    case "hang-up":
      return `Hang up ${title} at ${where(step.to)}`;
    case "replace":
      return `Replace ${title} with ${titleOf(step.id)} at ${where(step.at)}`;
  }
}
