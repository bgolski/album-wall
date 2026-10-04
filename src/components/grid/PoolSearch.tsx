interface PoolSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  className?: string;
}

/**
 * A search field for the record pool with a clear button. The text is 16px so iOS Safari does
 * not zoom the page when the field is focused.
 */
export function PoolSearch({ query, onQueryChange, className = "" }: PoolSearchProps) {
  return (
    <div className={`relative ${className}`}>
      <label htmlFor="pool-search" className="sr-only">
        Search the record pool
      </label>
      <input
        id="pool-search"
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search the pool"
        autoComplete="off"
        className="w-full rounded-control border border-line bg-raised py-2 pl-3 pr-10 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-hidden [&::-webkit-search-cancel-button]:appearance-none"
      />
      {query && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onQueryChange("")}
          className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:text-ink"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
            <path d="M18.3 5.7a1 1 0 0 0-1.4 0L12 10.6 7.1 5.7a1 1 0 0 0-1.4 1.4l4.9 4.9-4.9 4.9a1 1 0 1 0 1.4 1.4l4.9-4.9 4.9 4.9a1 1 0 0 0 1.4-1.4L13.4 12l4.9-4.9a1 1 0 0 0 0-1.4z" />
          </svg>
        </button>
      )}
    </div>
  );
}
