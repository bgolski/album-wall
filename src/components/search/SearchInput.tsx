import { AppHeader } from "../layout/AppHeader";
import { SubmitButton } from "../ui/SubmitButton";
import { FolderPicker } from "./FolderPicker";
import type { DiscogsAccountProps } from "../account/DiscogsAccount";
import type { DiscogsFolder } from "@/utils/discogsSignIn";

interface SearchInputProps {
  username: string;
  isPending: boolean;
  usernameError: string | null;
  onUsernameChange: (value: string) => void;
  onLoadCollection: () => void;
  onTryDemo?: (() => void) | undefined;
  account?: DiscogsAccountProps | undefined;
  /** The signed-in visitor's folders, offered while their own username is entered. */
  folders?: DiscogsFolder[];
  folderId?: number;
  onFolderChange?: (folderId: number) => void;
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
  onTryDemo,
  account,
  folders = [],
  folderId = 0,
  onFolderChange,
}: SearchInputProps) {
  const showFolders =
    folders.length > 1 &&
    onFolderChange !== undefined &&
    account?.username != null &&
    username.trim().toLowerCase() === account.username.toLowerCase();
  const inputClassName = `w-full rounded-control bg-raised border px-4 py-2 text-ink focus:outline-hidden focus:border-accent md:flex-1 md:rounded-r-none ${
    usernameError ? "border-danger" : "border-line"
  }`;

  const isSubmitDisabled = isPending || !username.trim();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isSubmitDisabled) onLoadCollection();
  };

  return (
    <div className="mb-8 text-center">
      <AppHeader onTryDemo={onTryDemo} demoDisabled={isPending} account={account} />

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
            className="mt-2 w-full max-w-sm text-left text-sm text-danger sm:max-w-md"
          >
            {usernameError}
          </p>
        )}

        {showFolders && (
          <FolderPicker
            folders={folders}
            folderId={folderId}
            disabled={isPending}
            onChange={onFolderChange}
          />
        )}
      </div>
    </div>
  );
}
