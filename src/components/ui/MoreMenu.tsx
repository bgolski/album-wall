import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDismiss } from "@/hooks/useDismiss";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  /** Shows a tick: the item states something that is already so. */
  checked?: boolean;
}

// Height a menu needs below its button to open downward, in pixels (about four items).
const MENU_ROOM = 200;

/**
 * A small "more" menu: a button with three dots that opens a short list of actions. The list is
 * drawn over the page, outside the panel, so a panel that scrolls never cuts it off; it opens
 * upward when there is little room below.
 *
 * @param props.label What the button is called for a screen reader.
 * @param props.items The actions, in order.
 */
export function MoreMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [place, setPlace] = useState<{ right: number; top?: number; bottom?: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const open = place !== null;

  useDismiss({
    open,
    inside: [menuRef, buttonRef],
    onDismiss: () => setPlace(null),
    returnFocus: buttonRef,
  });

  useEffect(() => {
    if (!open) return;
    // The list is placed where the button was, so any scrolling or resizing closes it.
    const handleResize = () => setPlace(null);
    const handleScroll = () => setPlace(null);
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  const toggle = () => {
    if (open) return setPlace(null);
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const right = window.innerWidth - rect.right;
    setPlace(
      window.innerHeight - rect.bottom < MENU_ROOM
        ? { right, bottom: window.innerHeight - rect.top + 4 }
        : { right, top: rect.bottom + 4 }
    );
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        className="flex h-8 w-8 items-center justify-center rounded-control bg-raised text-ink hover:bg-line"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {place &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={label}
            style={place}
            className="fixed z-50 min-w-44 rounded-panel border border-line bg-panel p-1 shadow-xl"
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setPlace(null);
                  item.onSelect();
                }}
                className="block w-full rounded-control px-3 py-2 text-left text-sm text-ink hover:bg-raised"
              >
                {item.label}
                {item.checked && (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="ml-2 inline h-3 w-3 text-accent"
                  >
                    <path d="M3.5 8.5l3 3 6-7" />
                  </svg>
                )}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
