/**
 * Displays the application title and short onboarding copy above the search input.
 */
export function AppHeader() {
  return (
    <div className="mb-6 text-center">
      <h1 className="mb-4 text-3xl font-bold">Vinyl Wall</h1>
      <p className="mx-auto max-w-md text-sm text-gray-300 sm:text-base">
        Enter your Discogs username to load your vinyl collection and create a virtual record wall.
      </p>
    </div>
  );
}
