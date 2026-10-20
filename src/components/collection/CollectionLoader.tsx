import { LoadingSpinner } from "../ui/LoadingSpinner";

interface CollectionLoaderProps {
  username?: string;
}

/**
 * Displays the collection-loading state while a Discogs fetch is in progress: a record turning,
 * and whose collection it is.
 */
export function CollectionLoader({ username = "user" }: CollectionLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-10 flex flex-col items-center justify-center gap-4 px-4 py-12"
    >
      <LoadingSpinner className="h-20 w-20 text-accent" />
      <p className="text-lg text-muted">Loading {username}&apos;s collection</p>
    </div>
  );
}
