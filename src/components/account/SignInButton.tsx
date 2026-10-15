import { RecordIcon } from "./RecordIcon";

// A light pill with a mark on the left and the label centred.
const PILL =
  "relative flex h-11 w-full items-center justify-center rounded-full border border-line bg-panel px-12 font-medium text-ink shadow-sm transition hover:bg-raised hover:shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-70";

interface SignInButtonProps {
  onClick: () => void;
  disabled?: boolean;
  status: "idle" | "redirecting" | "finishing";
}

/**
 * The large "Sign in with Discogs" button on the start screen, in the style of the familiar
 * "Sign in with Google" buttons: a mark on the left and the label centred in a light pill.
 */
export function SignInButton({ onClick, disabled = false, status }: SignInButtonProps) {
  const label =
    status === "redirecting"
      ? "Opening Discogs…"
      : status === "finishing"
        ? "Signing in…"
        : "Sign in with Discogs";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || status !== "idle"}
      className={PILL}
    >
      <span className="absolute left-3 flex h-7 w-7 items-center justify-center text-ink">
        <RecordIcon className="h-6 w-6" />
      </span>
      {label}
    </button>
  );
}

interface OwnCollectionButtonProps {
  username: string;
  onClick: () => void;
  disabled?: boolean;
}

/**
 * The same pill once signed in: loads the visitor's own collection.
 */
export function OwnCollectionButton({
  username,
  onClick,
  disabled = false,
}: OwnCollectionButtonProps) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={PILL}>
      <span className="absolute left-3 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm font-bold uppercase text-on-accent">
        {username.slice(0, 1)}
      </span>
      Load my collection
    </button>
  );
}
