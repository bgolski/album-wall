import { ThemeToggle } from "./ThemeToggle";

/**
 * Displays the application title and short onboarding copy above the search input, with the
 * light and dark mode switch in the corner.
 */
export function AppHeader() {
  return (
    <div className="relative mb-6 text-center">
      <div className="absolute right-0 top-0">
        <ThemeToggle />
      </div>
      <h1 className="mb-4 text-3xl font-bold">Vinyl Wall</h1>
      <p className="mx-auto max-w-md text-sm text-muted sm:text-base">
        Enter your Discogs username to load your vinyl collection and create a virtual record wall.
      </p>
    </div>
  );
}
