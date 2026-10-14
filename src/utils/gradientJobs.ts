import { runJob, type BuildResult, type GradientJob, type SuggestResult } from "./gradientWork";

type BuildInput = Extract<GradientJob, { kind: "build" }>["input"];
type SuggestInput = Extract<GradientJob, { kind: "suggest" }>["input"];

// The worker imports only gradientWork, never this file, so its bundle does not contain itself.
let worker: Worker | null | undefined;
let nextId = 0;
const waiting = new Map<
  number,
  { job: GradientJob; resolve: (result: BuildResult | SuggestResult) => void }
>();

// Anything the worker cannot do (it failed to start or crashed) is done on the page instead.
function runWaitingHere() {
  for (const [id, { job, resolve }] of waiting) {
    waiting.delete(id);
    resolve(runJob(job));
  }
}

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker =
      typeof Worker === "undefined"
        ? null
        : new Worker(new URL("../workers/gradient.worker.ts", import.meta.url), {
            type: "module",
          });
  } catch {
    worker = null;
  }
  worker?.addEventListener("message", (event: MessageEvent) => {
    const { id, result } = event.data as { id: number; result?: BuildResult | SuggestResult };
    const entry = waiting.get(id);
    if (!entry) return;
    waiting.delete(id);
    entry.resolve(result ?? runJob(entry.job));
  });
  worker?.addEventListener("error", () => {
    worker?.terminate();
    worker = null;
    runWaitingHere();
  });
  return worker;
}

/**
 * Builds a gradient wall or finds suggestions off the page's main thread, so even a very large
 * collection never freezes the page; where workers are unavailable the work runs on the page.
 *
 * @param job The work.
 * @returns Its result.
 */
export function runGradientJob(job: { kind: "build"; input: BuildInput }): Promise<BuildResult>;
export function runGradientJob(job: {
  kind: "suggest";
  input: SuggestInput;
}): Promise<SuggestResult>;
export function runGradientJob(job: GradientJob): Promise<BuildResult | SuggestResult> {
  const target = getWorker();
  if (!target) return Promise.resolve().then(() => runJob(job));
  return new Promise((resolve) => {
    nextId += 1;
    waiting.set(nextId, { job, resolve });
    target.postMessage({ id: nextId, job });
  });
}
