import { ThemeToggle } from "./ThemeToggle";
import { DiscogsAccount, DiscogsAccountProps } from "../account/DiscogsAccount";

interface AppHeaderProps {
  onTryDemo?: (() => void) | undefined;
  demoDisabled?: boolean;
  /** Signing in with Discogs, when the app offers it. */
  account?: DiscogsAccountProps | undefined;
}

/**
 * Displays the application title and short onboarding copy above the search input, with the
 * light and dark mode switch in the corner and, when the demo wall is available, a quiet link to it.
 */
export function AppHeader({ onTryDemo, demoDisabled = false, account }: AppHeaderProps) {
  return (
    <div className="relative mb-6 text-center">
      <div className="absolute right-0 top-0">
        <ThemeToggle />
      </div>
      {onTryDemo && (
        <button
          type="button"
          onClick={onTryDemo}
          disabled={demoDisabled}
          aria-label="Try the demo wall"
          // In the opposite corner on phones, where the title leaves no room beside the switch.
          className="absolute left-0 top-0 h-9 rounded-control px-2 text-sm text-muted hover:text-ink disabled:opacity-50 sm:left-auto sm:right-11"
        >
          Demo
        </button>
      )}
      <h1 className="mb-4 text-3xl font-bold">Album Wall</h1>
      <p className="mx-auto max-w-md text-sm text-muted sm:text-base">
        Enter your Discogs username to load your vinyl collection and create a virtual record wall.
      </p>
      {account && <DiscogsAccount {...account} />}
    </div>
  );
}
