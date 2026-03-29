import { AppHeader } from "../layout/AppHeader";
import { SubmitButton } from "../ui/SubmitButton";

interface SearchInputProps {
  username: string;
  isPending: boolean;
  usernameError: string | null;
  onUsernameChange: (value: string) => void;
  onLoadCollection: () => void;
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

        {usernameError && (
          <p className="mt-2 w-full max-w-sm text-left text-sm text-red-400 sm:max-w-md">
            {usernameError}
          </p>
        )}
      </div>
    </div>
  );
}
