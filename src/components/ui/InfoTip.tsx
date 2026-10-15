import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface InfoTipProps {
  /** Id of the explanation, for the option's `aria-describedby`. */
  id: string;
  /** The option it explains, for the button's name. */
  label: string;
  /** One short sentence. */
  text: string;
}

// Widest the explanation gets, and how far it keeps from the window's edges and from the icon.
const TIP_WIDTH = 208;
const EDGE = 8;
const GAP = 6;

/**
 * A small ⓘ beside an option. Hovering or focusing it shows a one-line explanation; tapping it
 * shows it on a phone, and a tap elsewhere or Escape hides it; it follows the icon as the page scrolls. The explanation is drawn
 * over the whole page (so a scrolling panel cannot cut it off), above the icon and inside the
 * window. Screen readers get the same text as the option's description through `aria-describedby`.
 */
export function InfoTip({ id, label, text }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [place, setPlace] = useState<{ left: number; bottom: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const shown = open || hovered;

  const measure = () => {
    const box = buttonRef.current?.getBoundingClientRect();
    if (!box) return;
    const width = Math.min(TIP_WIDTH, window.innerWidth - 2 * EDGE);
    const left = Math.min(
      Math.max(box.left + box.width / 2 - width / 2, EDGE),
      window.innerWidth - width - EDGE
    );
    setPlace({ left, bottom: window.innerHeight - box.top + GAP, width });
  };

  useEffect(() => {
    if (!shown) return;
    const close = () => {
      setOpen(false);
      setHovered(false);
    };
    const handlePointer = (event: PointerEvent) => {
      if (!buttonRef.current?.contains(event.target as Node)) close();
    };
    // Caught first and marked handled, so Escape closes the explanation and not the panel around it.
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close();
    };
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey, true);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey, true);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [shown]);

  const show = () => {
    measure();
    setHovered(true);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`About ${label}`}
        aria-expanded={open}
        onClick={() => {
          measure();
          setOpen((value) => !value);
        }}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") show();
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") setHovered(false);
        }}
        onFocus={show}
        onBlur={() => setHovered(false)}
        className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:text-ink focus-visible:text-ink"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
        >
          <circle cx="10" cy="10" r="8.25" strokeWidth="1.5" />
          <path d="M10 9v5" strokeWidth="1.75" strokeLinecap="round" />
          <circle cx="10" cy="6.25" r="1" fill="currentColor" stroke="none" />
        </svg>
      </button>
      <span id={id} className="sr-only">
        {text}
      </span>
      {shown &&
        place &&
        typeof document !== "undefined" &&
        createPortal(
          <span
            role="tooltip"
            aria-hidden="true"
            style={{ left: place.left, bottom: place.bottom, width: place.width }}
            className="pointer-events-none fixed z-70 rounded-control bg-ink px-3 py-2 text-xs leading-snug text-page shadow-lg"
          >
            {text}
          </span>,
          document.body
        )}
    </>
  );
}
