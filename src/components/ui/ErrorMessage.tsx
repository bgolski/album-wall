interface ErrorMessageProps {
  error: string;
  username: string;
  onRetry: () => void;
}

export function ErrorMessage({ error, username, onRetry }: ErrorMessageProps) {
  return (
    <div className="mb-10 flex flex-col items-center justify-center py-12 px-6 bg-gray-800 rounded-lg">
      <svg
        className="w-16 h-16 text-red-500 mb-4"
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
      <h3 className="text-xl font-bold text-white mb-2">Error Loading Collection</h3>
      <p className="text-gray-300 mb-4 text-center">{error}</p>
      <p className="text-gray-400 mb-6 text-center text-sm">
        {username
          ? `We couldn't find "${username}" on Discogs or encountered a problem loading their collection.`
          : "There was a problem with the Discogs API."}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
        <a
          href="https://www.discogs.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
        >
          Visit Discogs
        </a>
      </div>
    </div>
  );
}
