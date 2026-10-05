"use client";

import { AppContainer } from "./layout/AppContainer";
import { SearchInput } from "./search/SearchInput";
import { CollectionManager } from "./collection/CollectionManager";
import { useCollection } from "@/hooks/useCollection";

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
    canUndo,
    loadCollection,
    handleUsernameChange,
    handleAlbumsReorder,
    undo,
    forgetUndo,
    retry,
  } = useCollection();

  return (
    <AppContainer>
      <SearchInput
        username={username}
        isPending={isPending}
        usernameError={usernameError}
        onUsernameChange={handleUsernameChange}
        onLoadCollection={loadCollection}
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
    </AppContainer>
  );
}
