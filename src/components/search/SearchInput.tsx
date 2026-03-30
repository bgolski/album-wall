import { AppHeader } from "../layout/AppHeader";
import { SubmitButton } from "../ui/SubmitButton";

interface SearchInputProps {
  username: string;
  isPending: boolean;
  usernameError: string | null;
  onUsernameChange: (value: string) => void;
  onLoadCollection: () => void;
  onLoadDemoCollection: () => void;
}

/**
 * Renders the Discogs username input and triggers collection loading.
 */
export function SearchInput({
  username,
  isPending,
  usernameError,
  onUsernameChange,
  onLoadCollection,
  onLoadDemoCollection,
}: SearchInputProps) {
  const inputClassName = `w-full rounded bg-gray-800 border px-4 py-2 text-white focus:outline-none focus:border-blue-500 md:flex-1 md:rounded-r-none ${
    usernameError ? "border-red-500" : "border-gray-700"
  }`;

  /**
   * Submits the collection load when the user presses Enter in the username input.
   *
   * @param e Keyboard event from the username input.
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") onLoadCollection();
  };

  const isSubmitDisabled = isPending || !username.trim();

  return (
    <div className="mb-8 text-center">
      <AppHeader />

      <div className="flex flex-col items-center">
        <div className="flex w-full max-w-sm flex-col items-stretch gap-2 sm:max-w-md md:flex-row md:items-center md:gap-0">
          <input
            type="text"
            value={username}
            onChange={(e) => onUsernameChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Your Discogs username"
            className={inputClassName}
            disabled={isPending}
          />
          <SubmitButton
            onClick={onLoadCollection}
            disabled={isSubmitDisabled}
            isLoading={isPending}
          />
        </div>

        <button
          type="button"
          onClick={onLoadDemoCollection}
          disabled={isPending}
          className="mt-3 inline-flex min-h-[42px] w-full max-w-sm items-center justify-center rounded border border-gray-700 bg-gray-800/80 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-gray-600 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 sm:max-w-md"
        >
          Try Demo Collection
        </button>

        {usernameError && (
          <p className="mt-2 w-full max-w-sm text-left text-sm text-red-400 sm:max-w-md">
            {usernameError}
          </p>
        )}
      </div>
    </div>
  );
}
