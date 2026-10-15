import type { CollectionErrorKind } from "@/hooks/useCollection";

interface ErrorMessageProps {
  error: string;
  username: string;
  onRetry: () => void;
  /** Why the load failed, when the app knows. */
  kind?: CollectionErrorKind;
  /** Offered when signing in would help: a private collection, or a sign-in that has ended. */
  onSignIn?: (() => void) | undefined;
}

interface Explanation {
  heading: string;
  /** What happened and what to do, in one or two plain sentences. */
  text: string;
  action: "retry" | "sign-in" | null;
  /** A warning sign for failures, but not for answers like "private" or "no such user". */
  warning: boolean;
}

/**
 * Says what went wrong in the visitor's terms.
 *
 * @param kind Why the load failed.
 * @param error The message the load failed with.
 * @param username The collection asked for.
 * @returns Heading, text and the action that helps.
 */
function explain(kind: CollectionErrorKind, error: string, username: string): Explanation {
  switch (kind) {
    case "private":
      return { heading: "Private collection", text: error, action: "sign-in", warning: false };
    case "private-shared":
      return { heading: "Private collection", text: error, action: "sign-in", warning: false };
    case "signed-out":
      return { heading: "Signed out", text: error, action: "sign-in", warning: false };
    case "not-found":
      return {
        heading: username ? `No Discogs user "${username}"` : "No such Discogs user",
        text: "Check the spelling: it is the name in your Discogs profile address, discogs.com/user/your-name.",
        action: null,
        warning: false,
      };
    case "busy":
      return {
        heading: "Discogs needs a short break",
        text: "Too many requests reached Discogs at once. Try again in a minute.",
        action: "retry",
        warning: true,
      };
    case "unavailable":
      return {
        heading: "Discogs isn't answering",
        text: "Discogs or the connection didn't respond. Nothing is lost; try again in a minute.",
        action: "retry",
        warning: true,
      };
    default:
      return {
        heading: "The collection didn't load",
        text: error,
        action: "retry",
        warning: true,
      };
  }
}

/**
 * Explains why a collection did not load, with the one action that helps: try again for a
 * passing problem, sign in for a private collection, or nothing extra when the name is wrong
 * (the username box is right above).
 */
export function ErrorMessage({
  error,
  username,
  onRetry,
  kind = null,
  onSignIn,
}: ErrorMessageProps) {
  const { heading, text, action, warning } = explain(kind, error, username);
  return (
    <div
      role="alert"
      className="mb-10 flex flex-col items-center justify-center rounded-panel bg-panel px-6 py-12 text-center"
    >
      {warning && (
        <svg
          aria-hidden="true"
          className="mb-4 h-12 w-12 text-danger"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      )}
      <h3 className="mb-2 text-xl font-bold text-ink">{heading}</h3>
      <p className="mb-6 max-w-lg text-muted">{text}</p>
      {action === "retry" && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-control bg-accent px-4 py-2 text-on-accent transition-colors hover:bg-accent-hover"
        >
          Try again
        </button>
      )}
      {action === "sign-in" && onSignIn && (
        <button
          type="button"
          onClick={onSignIn}
          className="rounded-control bg-accent px-4 py-2 text-on-accent transition-colors hover:bg-accent-hover"
        >
          Sign in with Discogs
        </button>
      )}
    </div>
  );
}
