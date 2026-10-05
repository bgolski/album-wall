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

  const isSubmitDisabled = isPending || !username.trim();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isSubmitDisabled) onLoadCollection();
  };

  return (
    <div className="mb-8 text-center">
      <AppHeader />

      <div className="flex flex-col items-center">
        <form
          onSubmit={handleSubmit}
          className="flex w-full max-w-sm flex-col items-stretch gap-2 sm:max-w-md md:flex-row md:items-center md:gap-0"
        >
          <label htmlFor="discogs-username" className="sr-only">
            Discogs username
          </label>
          <input
            id="discogs-username"
            autoComplete="username"
            type="text"
            value={username}
            onChange={(e) => onUsernameChange(e.target.value)}
            placeholder="Your Discogs username"
            className={inputClassName}
            disabled={isPending}
            aria-invalid={usernameError ? true : undefined}
            aria-describedby={usernameError ? "discogs-username-error" : undefined}
          />
          <SubmitButton disabled={isSubmitDisabled} isLoading={isPending} />
        </form>

        {usernameError && (
          <p
            id="discogs-username-error"
            className="mt-2 w-full max-w-sm text-left text-sm text-red-400 sm:max-w-md"
          >
            {usernameError}
          </p>
        )}
      </div>
    </div>
  );
}
