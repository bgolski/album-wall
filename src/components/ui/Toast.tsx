import type { ExportStatus } from "@/hooks/useGridExport";

interface ToastProps {
  toast: ExportStatus | null;
  onDismiss: () => void;
}

/**
 * Shows a short message near the bottom of the screen, with an optional action button.
 * Errors are announced immediately; other messages politely.
 */
export function Toast({ toast, onDismiss }: ToastProps) {
  if (!toast) return null;

  const isError = toast.tone === "error";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-60 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div
        role={isError ? "alert" : "status"}
        className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-control px-4 py-3 text-sm shadow-lg ${
          isError ? "bg-danger text-on-danger" : "bg-ink text-page"
        }`}
      >
        <span>{toast.message}</span>
        {toast.action && (
          <button
            type="button"
            className="rounded-control bg-current/15 px-3 py-1 font-medium hover:bg-current/25"
            onClick={() => {
              onDismiss();
              toast.action?.run();
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </div>
  );
}
