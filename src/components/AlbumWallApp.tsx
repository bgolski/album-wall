"use client";

import { AppContainer } from "./layout/AppContainer";
import { SearchInput } from "./search/SearchInput";
import { CollectionManager } from "./collection/CollectionManager";
import { WelcomeDialog } from "./search/WelcomeDialog";
import { useEffect } from "react";
import { useCollection } from "@/hooks/useCollection";
import { useWelcome } from "@/hooks/useWelcome";
import { useDiscogsSignIn } from "@/hooks/useDiscogsSignIn";
import { useDiscogsFolders } from "@/hooks/useDiscogsFolders";

/**
 * Top-level client component that wires collection state to the search and display flows.
 */
export default function AlbumWallApp() {
  const discogs = useDiscogsSignIn();
  const { session, signOut } = discogs;
  const folders = useDiscogsFolders(session);
  const {
    albums,
    username,
    loadedUsername,
    loadCount,
    sharedWallState,
    isPending,
    error,
    errorKind,
    folderId,
    usernameError,
    demoAvailable,
    canUndo,
    loadCollection,
    handleUsernameChange,
    handleAlbumsReorder,
    undo,
    forgetUndo,
    retry,
    loadDemo,
    chooseFolder,
    loadOwnCollection,
  } = useCollection(session, signOut);
  const welcome = useWelcome(demoAvailable, albums.length > 0);

  // Straight after signing in, load the visitor's own collection.
  const { justSignedIn } = discogs;
  useEffect(() => {
    if (justSignedIn) loadOwnCollection(justSignedIn);
    // Only when a sign-in finishes; loadOwnCollection changes with every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justSignedIn]);

  const account = {
    username: session?.username ?? null,
    busy: isPending,
    status: discogs.status,
    error: discogs.error,
    onSignIn: () => void discogs.signIn(),
    onSignOut: signOut,
  };

  const tryDemo = () => {
    welcome.dismiss();
    loadDemo();
  };

  return (
    <AppContainer>
      <SearchInput
        username={username}
        isPending={isPending}
        usernameError={usernameError}
        onUsernameChange={handleUsernameChange}
        onLoadCollection={loadCollection}
        onTryDemo={demoAvailable ? tryDemo : undefined}
        account={account}
        folders={folders}
        folderId={folderId}
        onFolderChange={chooseFolder}
      />

      <CollectionManager
        albums={albums}
        username={username}
        loadedUsername={loadedUsername}
        loadCount={loadCount}
        sharedWallState={sharedWallState}
        isPending={isPending}
        error={error}
        errorKind={errorKind}
        onSignIn={session ? undefined : account.onSignIn}
        onAlbumsReorder={handleAlbumsReorder}
        canUndo={canUndo}
        onUndo={undo}
        onPinsChange={forgetUndo}
        onRetry={retry}
      />

      {welcome.open && <WelcomeDialog onTryDemo={tryDemo} onClose={welcome.dismiss} />}
    </AppContainer>
  );
}
