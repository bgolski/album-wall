import { SearchField } from "../ui/SearchField";

interface PoolSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  className?: string;
}

/**
 * The search field for the remaining records, with a clear button once something is typed.
 */
export function PoolSearch({ query, onQueryChange, className = "" }: PoolSearchProps) {
  return (
    <SearchField
      id="pool-search"
      label="Search"
      type="search"
      value={query}
      onChange={onQueryChange}
      placeholder="Search"
      className={className}
    >
      {query && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onQueryChange("")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-line hover:text-ink"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
            <path d="M18.3 5.7a1 1 0 0 0-1.4 0L12 10.6 7.1 5.7a1 1 0 0 0-1.4 1.4l4.9 4.9-4.9 4.9a1 1 0 1 0 1.4 1.4l4.9-4.9 4.9 4.9a1 1 0 0 0 1.4-1.4L13.4 12l4.9-4.9a1 1 0 0 0 0-1.4z" />
          </svg>
        </button>
      )}
    </SearchField>
  );
}
