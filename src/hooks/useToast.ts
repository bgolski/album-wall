import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { ToastState } from "@/components/ui/Toast";

const STATUS_VISIBLE_MS = 4000;
const ACTION_VISIBLE_MS = 15000;

/**
 * The page's toast: a short notice near the bottom of the screen. It goes away on its own; one
 * that offers an action stays longer so it can be used, and one marked busy stays until it is
 * replaced or cleared.
 */
export function useToast(): {
  toast: ToastState | null;
  /** Shows a toast, or clears it with null; also takes an updater like React's setState. */
  show: Dispatch<SetStateAction<ToastState | null>>;
  /** Shows an information notice. */
  notify: (message: string) => void;
} {
  const [toast, show] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!toast || toast.busy) return;
    const timer = window.setTimeout(
      () => show(null),
      toast.action ? ACTION_VISIBLE_MS : STATUS_VISIBLE_MS
    );
    return () => window.clearTimeout(timer);
  }, [toast]);

  const notify = useCallback((message: string) => show({ message, tone: "info" }), []);
  return { toast, show, notify };
}
