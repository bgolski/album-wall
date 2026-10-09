import { useEffect, useRef } from "react";

interface WelcomeDialogProps {
  onTryDemo: () => void;
  onClose: () => void;
}

/**
 * Greets a first-time visitor with the choice between a demo wall and their own Discogs
 * collection. Closes on Escape or a tap outside the panel.
 */
export function WelcomeDialog({ onTryDemo, onClose }: WelcomeDialogProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-3"
      onClick={onClose}
      data-testid="welcome-backdrop"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        className="w-full max-w-md rounded-panel bg-panel p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="welcome-title" className="mb-2 text-xl font-bold text-ink">
          New to Vinyl Wall?
        </h2>
        <p className="mb-5 text-ink">
          Enter your Discogs username to turn your collection into a wall. Want a look first? Try a
          demo wall of well-known albums.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={onTryDemo}
            className="rounded-control bg-accent px-4 py-2 font-medium text-on-accent hover:bg-accent-hover"
          >
            Try the demo
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-control bg-raised px-4 py-2 text-ink hover:bg-line"
          >
            I&apos;ll use my username
          </button>
        </div>
      </div>
    </div>
  );
}
