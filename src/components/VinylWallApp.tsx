"use client";

import { AppContainer } from "./AppContainer";
import { SearchInput } from "./SearchInput";
import { CollectionManager } from "./CollectionManager";
import { useCollection } from "@/hooks/useCollection";

export default function VinylWallApp() {
  const {
    albums,
    username,
    loadedUsername,
    isPending,
    error,
    usernameError,
    loadCollection,
    handleUsernameChange,
    handleAlbumsReorder,
    retry,
  } = useCollection();

  return (
    <AppContainer>
      <SearchInput
        username={username}
        isPending={isPending}
        usernameError={usernameError}
        error={error}
        onUsernameChange={handleUsernameChange}
        onLoadCollection={loadCollection}
      />

      <CollectionManager
        albums={albums}
        username={username}
        loadedUsername={loadedUsername}
        isPending={isPending}
        error={error}
        onAlbumsReorder={handleAlbumsReorder}
        onRetry={retry}
      />
    </AppContainer>
  );
}
