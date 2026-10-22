import Link from "next/link";
import { useRef, useState } from "react";
import type { DiscogsAccountProps } from "./types";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { useDismiss } from "@/hooks/useDismiss";

/**
 * The account control in the header corner. Signed in, a round button with the visitor's initial
 * opens a small menu: who is signed in, their collection, where their saved walls are kept, and
 * Sign out. Signed out,
 * a small "Sign in" button (an icon on phones), so signing in stays at hand once a wall is showing.
 */
export function AccountMenu({
  username,
  busy,
  status,
  onSignIn,
  onSignOut,
  onLoadOwn,
}: DiscogsAccountProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useDismiss({ open, inside: [rootRef], onDismiss: () => setOpen(false), returnFocus: buttonRef });

  const cornerButton =
    "flex h-9 items-center justify-center rounded-control border border-line bg-raised text-ink transition-colors hover:bg-line disabled:opacity-60";

  if (status === "finishing") {
    return (
      <span role="status" className={`${cornerButton} w-9`} aria-label="Signing in with Discogs">
        <LoadingSpinner className="h-5 w-5 text-muted" />
      </span>
    );
  }

  if (!username) {
    return (
      <button
        type="button"
        onClick={onSignIn}
        disabled={status === "redirecting"}
        aria-label="Sign in"
        title="Sign in with Discogs"
        className={`${cornerButton} w-9 sm:w-auto sm:px-3`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-5 w-5 sm:hidden"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" strokeLinecap="round" />
        </svg>
        <span className="hidden text-sm font-medium sm:inline">Sign in</span>
      </button>
    );
  }

  const choose = (action: () => void) => () => {
    setOpen(false);
    action();
  };
  const item =
    "block w-full rounded-control px-3 py-2 text-left text-sm text-ink hover:bg-raised disabled:opacity-50";

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="account-menu"
        aria-label={`Account: signed in as ${username}`}
        title={`Signed in as ${username}`}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold uppercase text-on-accent hover:bg-accent-hover"
      >
        {username.slice(0, 1)}
      </button>
      {open && (
        <div
          id="account-menu"
          className="absolute right-0 top-11 z-40 w-60 rounded-panel border border-line bg-panel p-2 text-left shadow-xl"
        >
          <p className="truncate px-3 pb-2 pt-1 text-sm font-semibold text-ink">{username}</p>
          <div className="border-t border-line pt-1">
            {onLoadOwn && (
              <button type="button" onClick={choose(onLoadOwn)} disabled={busy} className={item}>
                Load my collection
              </button>
            )}
            <Link href="/privacy/#saved-walls" className={item}>
              Privacy
            </Link>
            <button type="button" onClick={choose(onSignOut)} className={item}>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
