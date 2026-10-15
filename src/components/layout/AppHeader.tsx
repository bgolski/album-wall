import { ThemeToggle } from "./ThemeToggle";
import { AccountMenu } from "../account/AccountMenu";
import type { DiscogsAccountProps } from "../account/types";

interface AppHeaderProps {
  onTryDemo?: (() => void) | undefined;
  demoDisabled?: boolean;
  /** Signing in with Discogs, when the app offers it. */
  account?: DiscogsAccountProps | undefined;
  /** Once a wall is showing: a smaller title and no introduction, so the wall comes first. */
  compact?: boolean;
}

/**
 * The title, with the account control and the light and dark mode switch in the right corner and,
 * when the demo wall is available, a quiet link to it (in the left corner on phones, where the
 * title leaves no room beside the others). Before a wall is showing, a one-line introduction.
 */
export function AppHeader({
  onTryDemo,
  demoDisabled = false,
  account,
  compact = false,
}: AppHeaderProps) {
  return (
    <div className={`relative text-center ${compact ? "mb-3" : "mb-6"}`}>
      {/* A full-width row over the title, so on phones the demo link can sit in the left corner
          while the other controls stay right. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-end gap-1.5 sm:gap-2 [&>*]:pointer-events-auto">
        {onTryDemo && (
          <button
            type="button"
            onClick={onTryDemo}
            disabled={demoDisabled}
            aria-label="Try the demo wall"
            className="h-9 rounded-control px-2 text-sm text-muted hover:text-ink disabled:opacity-50 max-sm:absolute max-sm:left-0 max-sm:top-0"
          >
            Demo
          </button>
        )}
        <ThemeToggle />
        {/* Signed out, the start screen has the large sign-in button; the corner offers it once
            a wall is showing. */}
        {account && (account.username || account.status === "finishing" || compact) && (
          <AccountMenu {...account} />
        )}
      </div>
      <h1
        className={`font-bold ${compact ? "mb-1 text-2xl leading-9" : "mb-4 text-[1.75rem] sm:text-3xl"}`}
      >
        Album Wall
      </h1>
      {!compact && (
        <p className="mx-auto max-w-md text-sm text-muted sm:text-base">
          Plan a record wall from a Discogs collection.
        </p>
      )}
      {account?.error && (
        <p role="alert" className="mx-auto mt-2 max-w-md text-sm text-danger">
          {account.error}
        </p>
      )}
    </div>
  );
}
