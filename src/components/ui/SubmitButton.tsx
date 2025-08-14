import { LoadingSpinner } from "./LoadingSpinner";

interface SubmitButtonProps {
  onClick: () => void;
  disabled: boolean;
  isLoading: boolean;
}

export function SubmitButton({ onClick, disabled, isLoading }: SubmitButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 rounded-r bg-blue-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
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
