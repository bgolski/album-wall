interface ErrorMessageProps {
  error: string;
  username: string;
  onRetry: () => void;
}

/**
 * Displays collection-loading errors with retry and Discogs fallback actions.
 */
export function ErrorMessage({ error, username, onRetry }: ErrorMessageProps) {
  return (
    <div className="mb-10 flex flex-col items-center justify-center py-12 px-6 bg-panel rounded-panel">
      <svg
        aria-hidden="true"
        className="w-16 h-16 text-danger mb-4"
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
      <h3 className="text-xl font-bold text-ink mb-2">Error Loading Collection</h3>
      <p className="text-muted mb-4 text-center">{error}</p>
      <p className="text-muted mb-6 text-center text-sm">
        {username
          ? `We couldn't find "${username}" on Discogs or encountered a problem loading their collection.`
          : "There was a problem with the Discogs API."}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-accent text-on-accent rounded-control hover:bg-accent-hover transition-colors"
        >
          Try Again
        </button>
        <a
          href="https://www.discogs.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-raised text-ink rounded-control hover:bg-line transition-colors"
        >
          Visit Discogs
        </a>
      </div>
    </div>
  );
}
