import { useRef, useState } from "react";
import { AppHeader } from "../layout/AppHeader";
import { useDismiss } from "@/hooks/useDismiss";
import { UsernameForm } from "./UsernameForm";
import { validateDiscogsUsername } from "@/collection/discogs";
import { FolderPicker } from "./FolderPicker";
import { OwnCollectionButton, SignInButton } from "../account/SignInButton";
import type { DiscogsAccountProps } from "../account/types";
import type { DiscogsFolder } from "@/account/discogsSignIn";

/** The collection on the wall, shown in one line in place of the form. */
interface ShownCollection {
  /** The Discogs username, or the demo's name. */
  username: string;
  albumCount: number;
  isDemo: boolean;
}

interface SearchInputProps {
  username: string;
  isPending: boolean;
  usernameError: string | null;
  onUsernameChange: (value: string) => void;
  /** Loads the collection named in the box, or the name given. */
  onLoadCollection: (name?: string) => void;
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
 * folder and a search button that opens a small box over the page (so nothing moves) to open
 * another collection.
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
  const offerSignIn = account !== undefined && account.username === null;
  const ownUsername = account?.username ?? null;
  const offerOwn = ownUsername !== null && account?.onLoadOwn !== undefined;

  // The box for opening another collection, drawn over the page from the collection bar.
  const [searching, setSearching] = useState(false);
  const [draft, setDraft] = useState("");
  const searchRef = useRef<HTMLDivElement | null>(null);
  const searchButtonRef = useRef<HTMLButtonElement | null>(null);
  useDismiss({
    open: searching,
    inside: [searchRef, searchButtonRef],
    onDismiss: () => setSearching(false),
    returnFocus: searchButtonRef,
  });

  if (shown) {
    return (
      <div className="mb-4 text-center">
        <AppHeader account={account} compact />
        <div className="relative mx-auto max-w-xl">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-panel bg-panel px-4 py-2 shadow-sm">
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
              ref={searchButtonRef}
              type="button"
              onClick={() => {
                setDraft("");
                setSearching((open) => !open);
              }}
              aria-label="Open another collection"
              title="Open another collection"
              aria-expanded={searching}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-raised text-ink hover:bg-line"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="h-4 w-4"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </button>
          </div>
          {searching && (
            <div
              ref={searchRef}
              role="group"
              aria-label="Open another collection"
              className="absolute inset-x-0 top-full z-40 mt-2 rounded-panel border border-line bg-panel p-3 shadow-xl"
            >
              <UsernameForm
                value={draft}
                onChange={setDraft}
                onSubmit={() => {
                  const name = draft.trim();
                  onLoadCollection(name);
                  // A name that cannot be loaded keeps the box open, with the reason in it.
                  if (validateDiscogsUsername(name)) setSearching(false);
                }}
                isPending={isPending}
                error={usernameError}
                autoFocus
              />
              {(offerOwn || onTryDemo) && (
                <div className="mt-2 flex justify-center gap-4 text-sm">
                  {offerOwn && (
                    <button
                      type="button"
                      className="text-accent hover:underline"
                      onClick={() => {
                        setSearching(false);
                        account!.onLoadOwn!();
                      }}
                    >
                      My collection
                    </button>
                  )}
                  {onTryDemo && (
                    <button
                      type="button"
                      className="text-accent hover:underline"
                      onClick={() => {
                        setSearching(false);
                        onTryDemo();
                      }}
                    >
                      Demo
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
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
              or
              <span className="h-px flex-1 bg-line" />
            </div>
          </div>
        )}
        {offerSignIn && (
          <div className="mb-5 flex w-full max-w-sm flex-col items-center sm:max-w-md">
            <SignInButton onClick={account.onSignIn} disabled={isPending} status={account.status} />
            <div
              className="mt-5 flex w-full items-center gap-3 text-xs text-muted"
              aria-hidden="true"
            >
              <span className="h-px flex-1 bg-line" />
              or
              <span className="h-px flex-1 bg-line" />
            </div>
          </div>
        )}
        <UsernameForm
          value={username}
          onChange={onUsernameChange}
          onSubmit={() => onLoadCollection()}
          isPending={isPending}
          error={usernameError}
        />

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
