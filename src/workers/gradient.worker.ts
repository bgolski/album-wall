import { runJob, type GradientJob } from "@/utils/gradientWork";

// Builds gradient walls and finds suggestions away from the page's main thread.
self.addEventListener("message", (event: MessageEvent<{ id: number; job: GradientJob }>) => {
  const { id, job } = event.data;
  try {
    self.postMessage({ id, result: runJob(job) });
  } catch {
    // The page runs the job itself when no result comes back.
    self.postMessage({ id });
  }
});
