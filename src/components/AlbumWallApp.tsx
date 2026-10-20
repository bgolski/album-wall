"use client";

import { AppContainer } from "./layout/AppContainer";
import { SearchInput } from "./search/SearchInput";
import { CollectionManager } from "./collection/CollectionManager";
import { WelcomeCard } from "./search/WelcomeCard";
import { useEffect, useMemo } from "react";
import { SavedWallsContext } from "@/hooks/savedWallsContext";
import { savedWallsClient } from "@/utils/savedWalls";
import { DEMO_USERNAME } from "@/utils/demoCollection";
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
  // Signed in, saved layouts and wall history are kept in the visitor's account too.
  const savedWalls = useMemo(() => (session ? savedWallsClient(session) : null), [session]);
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
    // Offered only while someone else's collection (or the demo) is on the wall: nothing to load
    // when the visitor's own is already there.
    onLoadOwn:
      session && loadedUsername.trim().toLowerCase() !== session.username.toLowerCase()
        ? () => loadOwnCollection(session.username)
        : undefined,
  };

  // The form folds into a one-line bar while a collection is on the wall; a search button on the
  // bar opens a small box over the page to open another one.
  const shown =
    albums.length > 0 && loadedUsername && !error
      ? {
          username: loadedUsername,
          albumCount: albums.length,
          isDemo: loadedUsername === DEMO_USERNAME,
        }
      : null;

  const tryDemo = () => {
    welcome.dismiss();
    loadDemo();
  };

  return (
    <SavedWallsContext.Provider value={savedWalls}>
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
          shown={shown}
        />

        {welcome.open && <WelcomeCard onTryDemo={tryDemo} />}

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
      </AppContainer>
    </SavedWallsContext.Provider>
  );
}
