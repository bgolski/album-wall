import { LoadingSpinner } from "./LoadingSpinner";

interface SubmitButtonProps {
  onClick?: () => void;
  disabled: boolean;
  isLoading: boolean;
}

/**
 * Renders the collection-load submit button, a pill at the end of the username field, and swaps in a spinner while loading.
 */
export function SubmitButton({ onClick, disabled, isLoading }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      onClick={onClick}
      disabled={disabled}
      aria-busy={isLoading}
      className="flex min-h-10 shrink-0 items-center justify-center rounded-full bg-accent px-5 text-sm font-medium text-on-accent hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-panel disabled:text-muted"
    >
      {isLoading ? (
        <>
          <LoadingSpinner />
          Loading...
        </>
      ) : (
        <>
          <span aria-hidden="true">Load</span>
          <span className="sr-only">Load Collection</span>
        </>
      )}
    </button>
  );
}
