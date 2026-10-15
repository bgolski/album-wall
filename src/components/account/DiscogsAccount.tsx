import { useId, useState } from "react";
import { DISCOGS_APPLICATIONS_URL } from "@/utils/discogsSignIn";

export interface DiscogsAccountProps {
  /** The signed-in Discogs username, or null. */
  username: string | null;
  busy: boolean;
  status: "idle" | "redirecting" | "finishing";
  error: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

/**
 * "Sign in with Discogs" (or who is signed in and "Sign out"), with a short note on what signing
 * in keeps and where.
 */
export function DiscogsAccount({
  username,
  busy,
  status,
  error,
  onSignIn,
  onSignOut,
}: DiscogsAccountProps) {
  const [showNote, setShowNote] = useState(false);
  const noteId = useId();
  const linkClass = "underline underline-offset-2 hover:text-ink disabled:opacity-50";

  return (
    <div className="mx-auto mt-3 max-w-md text-sm text-muted">
      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        {status === "finishing" ? (
          <span role="status">Signing in with Discogs…</span>
        ) : username ? (
          <>
            <span>
              Signed in as <strong className="text-ink">{username}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <button type="button" onClick={onSignOut} className={linkClass}>
              Sign out
            </button>
          </>
        ) : (
          <span>
            <button
              type="button"
              onClick={onSignIn}
              disabled={busy || status === "redirecting"}
              className={linkClass}
            >
              {status === "redirecting" ? "Opening Discogs…" : "Sign in with Discogs"}
            </button>
            {/* Phones have room for the button alone; the note says the rest. */}
            <span className="hidden sm:inline"> for private collections and folders</span>
          </span>
        )}
        <span aria-hidden="true">·</span>
        <button
          type="button"
          onClick={() => setShowNote((open) => !open)}
          aria-expanded={showNote}
          aria-controls={noteId}
          className={linkClass}
        >
          What is kept
        </button>
      </p>
      {error && (
        <p role="alert" className="mt-2 text-danger">
          {error}
        </p>
      )}
      {showNote && (
        <div id={noteId} className="mt-3 space-y-2 rounded-panel bg-panel p-3 text-left text-xs">
          <p>
            Signing in takes you to Discogs to let Album Wall read your collection. Discogs then
            gives this browser a key, which is kept in this browser&apos;s storage and sent with
            each collection request. The Album Wall server passes it to Discogs and does not keep or
            log it.
          </p>
          <p>
            Sign out removes the key and the collection copies loaded with it from this browser. To
            withdraw access everywhere, remove Album Wall in your{" "}
            <a
              href={DISCOGS_APPLICATIONS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              Discogs application settings
            </a>
            .
          </p>
          <p>
            Share links open for other people only if your Discogs collection is public; a wall made
            from a folder opens with your whole collection.
          </p>
        </div>
      )}
    </div>
  );
}
