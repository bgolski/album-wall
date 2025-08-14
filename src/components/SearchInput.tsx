import { AppHeader } from "./AppHeader";
import { SubmitButton } from "./SubmitButton";

interface SearchInputProps {
  username: string;
  isPending: boolean;
  usernameError: string | null;
  onUsernameChange: (value: string) => void;
  onLoadCollection: () => void;
}

export function SearchInput({
  username,
  isPending,
  usernameError,
  onUsernameChange,
  onLoadCollection,
}: SearchInputProps) {
  const inputClassName = `flex-1 px-4 py-2 rounded-l bg-gray-800 border text-white focus:outline-none focus:border-blue-500 ${
    usernameError ? "border-red-500" : "border-gray-700"
  }`;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") onLoadCollection();
  };

  const isSubmitDisabled = isPending || !username.trim();

  return (
    <div className="mb-8 text-center">
      <AppHeader />

      <div className="flex flex-col items-center">
        <div className="flex justify-center items-center gap-2 max-w-sm w-full mx-auto">
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

        {usernameError && <p className="text-red-400 text-sm mt-2 max-w-sm">{usernameError}</p>}
      </div>
    </div>
  );
}
