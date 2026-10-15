import { useEffect, useRef, useState } from "react";

/** The panels that open beside the wall, one at a time. */
export type WallPanel = "size" | "layouts" | "color";

/**
 * Keeps at most one wall panel open. Closing a panel puts focus back on whatever opened it, and
 * Escape closes it.
 *
 * @returns The open panel and ways to open, toggle and close one.
 */
export function useOpenPanel() {
  const [panel, setPanel] = useState<WallPanel | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  const open = (next: WallPanel) => {
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      opener.current = document.activeElement;
    }
    setPanel(next);
  };

  const close = () => {
    setPanel(null);
    const target = opener.current;
    opener.current = null;
    // After the panel is gone, so focus does not land inside it.
    if (target) setTimeout(() => target.isConnected && target.focus(), 0);
  };

  const toggle = (next: WallPanel) => (panel === next ? close() : open(next));

  useEffect(() => {
    if (!panel) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      // A dialog or menu open over the panel handles its own Escape.
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"], [role="menu"]')) return;
      close();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [panel]);

  return { panel, open, toggle, close };
}
