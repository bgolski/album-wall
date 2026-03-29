import { LoadingSpinner } from "./LoadingSpinner";

interface SubmitButtonProps {
  onClick: () => void;
  disabled: boolean;
  isLoading: boolean;
}

/**
 * Renders the collection-load submit button and swaps in a spinner while loading.
 */
export function SubmitButton({ onClick, disabled, isLoading }: SubmitButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[42px] w-full items-center justify-center rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 md:min-w-[120px] md:w-auto md:rounded-l-none"
    >
      {isLoading ? (
        <>
          <LoadingSpinner />
          Loading...
        </>
      ) : (
        "Load Collection"
      )}
    </button>
  );
}
