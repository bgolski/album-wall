import { AppHeader } from "../layout/AppHeader";
import { SubmitButton } from "../ui/SubmitButton";
import { FolderPicker } from "./FolderPicker";
import { OwnCollectionButton, SignInButton } from "../account/SignInButton";
import type { DiscogsAccountProps } from "../account/types";
import type { DiscogsFolder } from "@/utils/discogsSignIn";

/** The collection on the wall, shown in one line in place of the form. */
export interface ShownCollection {
  /** The Discogs username, or the demo's name. */
  username: string;
  albumCount: number;
  isDemo: boolean;
  /** Opens the form again to load another collection. */
  onChange: () => void;
}

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
  /** Set while a collection is on the wall and the form is not being used. */
  shown?: ShownCollection | null | undefined;
}

/**
 * The start screen: "Sign in with Discogs" first (while signed out), then a username box for any
 * public collection. Once a collection is on the wall it shrinks to one line naming it, with its
 * folder and a way to load another.
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
  shown = null,
}: SearchInputProps) {
  // Every Discogs account has "All" (0) and "Uncategorized" (1); the picker is only worth showing
  // to someone who made folders of their own.
  const showFolders =
    folders.some((folder) => folder.id > 1) &&
    onFolderChange !== undefined &&
    account?.username != null &&
    username.trim().toLowerCase() === account.username.toLowerCase();
  const inputClassName = `w-full rounded-control bg-raised border px-4 py-2 text-ink focus:outline-hidden focus:border-accent md:flex-1 md:rounded-r-none ${
    usernameError ? "border-danger" : "border-line"
  }`;

  const isSubmitDisabled = isPending || !username.trim();
  const offerSignIn = account !== undefined && account.username === null;
  const ownUsername = account?.username ?? null;
  const offerOwn = ownUsername !== null && account?.onLoadOwn !== undefined;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isSubmitDisabled) onLoadCollection();
  };

  if (shown) {
    return (
      <div className="mb-4 text-center">
        <AppHeader account={account} compact />
        <div className="mx-auto flex max-w-xl flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-panel bg-panel px-4 py-2 shadow-sm">
          <p className="text-ink">
            {shown.isDemo ? (
              <span className="font-medium text-accent">Demo wall</span>
            ) : (
              <a
                href={`https://www.discogs.com/user/${encodeURIComponent(shown.username)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent hover:underline"
              >
                {shown.username}
              </a>
            )}
            <span className="text-muted"> · {shown.albumCount} albums</span>
          </p>
          {showFolders && onFolderChange && (
            <FolderPicker
              folders={folders}
              folderId={folderId}
              disabled={isPending}
              onChange={onFolderChange}
              className=""
            />
          )}
          <button
            type="button"
            onClick={shown.onChange}
            className="rounded-control bg-raised px-3 py-1 text-sm font-medium text-ink hover:bg-line"
            aria-label="Load another collection"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 text-center">
      <AppHeader onTryDemo={onTryDemo} demoDisabled={isPending} account={account} />

      <div className="flex flex-col items-center">
        {offerOwn && (
          <div className="mb-5 flex w-full max-w-sm flex-col items-center sm:max-w-md">
            <OwnCollectionButton
              username={ownUsername}
              onClick={account!.onLoadOwn!}
              disabled={isPending}
            />
            <div
              className="mt-5 flex w-full items-center gap-3 text-xs text-muted"
              aria-hidden="true"
            >
              <span className="h-px flex-1 bg-line" />
              or open any public collection
              <span className="h-px flex-1 bg-line" />
            </div>
          </div>
        )}
        {offerSignIn && (
          <div className="mb-5 flex w-full max-w-sm flex-col items-center sm:max-w-md">
            <SignInButton onClick={account.onSignIn} disabled={isPending} status={account.status} />
            <p className="mt-2 text-xs text-muted">For private collections and folders.</p>
            <div
              className="mt-5 flex w-full items-center gap-3 text-xs text-muted"
              aria-hidden="true"
            >
              <span className="h-px flex-1 bg-line" />
              or open any public collection
              <span className="h-px flex-1 bg-line" />
            </div>
          </div>
        )}
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
            placeholder={offerSignIn || offerOwn ? "A Discogs username" : "Your Discogs username"}
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
