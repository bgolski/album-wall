import type { Album } from "@/types";
import { buildGradientWall } from "@/components/gradient/buildGradientWall";
import { suggestGradients } from "@/components/gradient/suggestGradients";

type BuildInput = Parameters<typeof buildGradientWall>[0];
type SuggestInput = Parameters<typeof suggestGradients>[0];

/** Work for the gradient worker. */
export type GradientJob =
  { kind: "build"; input: BuildInput } | { kind: "suggest"; input: SuggestInput };

/** What a build sends back: the new order as album ids, and the build's summary. */
export type BuildResult = Omit<ReturnType<typeof buildGradientWall>, "albums"> & {
  order: Album["id"][];
};
export type SuggestResult = ReturnType<typeof suggestGradients>;

/**
 * Runs a job where it is called (inside the worker, or on the page when there is no worker).
 *
 * @param job The work.
 * @returns Its result; a build returns album ids rather than albums, so the page keeps its own.
 */
export function runJob(job: GradientJob): BuildResult | SuggestResult {
  if (job.kind === "suggest") return suggestGradients(job.input);
  const { albums, ...summary } = buildGradientWall(job.input);
  return { ...summary, order: albums.map((album) => album.id) };
}
