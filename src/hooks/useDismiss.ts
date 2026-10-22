import { useEffect, useRef, type RefObject } from "react";

// The popups open right now, oldest first: Escape belongs to the last one.
const open: object[] = [];

/**
 * Closes a popup (menu, tip, search box) when the visitor taps outside it or presses Escape.
 * Escape closes only the most recently opened popup and does not reach the page, so a panel
 * around the popup stays open.
 */
export function useDismiss(options: {
  open: boolean;
  /** Taps inside any of these (the popup and the button that opens it) keep it open. */
  inside: ReadonlyArray<RefObject<HTMLElement | null>>;
  onDismiss: () => void;
  /** Gets focus back after Escape, usually the button that opened the popup. */
  returnFocus?: RefObject<HTMLElement | null>;
}): void {
  // This popup's own latest options, so a new onDismiss each render does not restart the listeners.
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  useEffect(() => {
    if (!options.open) return;
    const entry = {};
    open.push(entry);

    const handlePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!latest.current.inside.some((ref) => ref.current?.contains(target))) {
        latest.current.onDismiss();
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || open[open.length - 1] !== entry) return;
      event.preventDefault();
      event.stopPropagation();
      latest.current.onDismiss();
      latest.current.returnFocus?.current?.focus();
    };

    document.addEventListener("pointerdown", handlePointer);
    window.addEventListener("keydown", handleKey, true);
    return () => {
      open.splice(open.indexOf(entry), 1);
      document.removeEventListener("pointerdown", handlePointer);
      window.removeEventListener("keydown", handleKey, true);
    };
  }, [options.open]);
}
