/** Whether an error means the visitor cancelled (a share sheet closed, a request aborted). */
export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
