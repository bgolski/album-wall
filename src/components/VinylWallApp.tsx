"use client";

import { AppContainer } from "./layout/AppContainer";
import { SearchInput } from "./search/SearchInput";
import { CollectionManager } from "./collection/CollectionManager";
import { WelcomeDialog } from "./search/WelcomeDialog";
import { useCollection } from "@/hooks/useCollection";
import { useWelcome } from "@/hooks/useWelcome";

/**
 * Top-level client component that wires collection state to the search and display flows.
 */
export default function VinylWallApp() {
  const {
    albums,
    username,
    loadedUsername,
    loadCount,
    sharedWallState,
    isPending,
    error,
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
  } = useCollection();
  const welcome = useWelcome(demoAvailable, albums.length > 0);

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
      />

      <CollectionManager
        albums={albums}
        username={username}
        loadedUsername={loadedUsername}
        loadCount={loadCount}
        sharedWallState={sharedWallState}
        isPending={isPending}
        error={error}
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
