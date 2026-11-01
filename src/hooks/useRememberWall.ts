import { useEffect, useRef } from "react";
import type { SharedWallState } from "@/types";
import { saveWall } from "@/utils/savedWall";
import { localStore } from "@/utils/browserStorage";

/**
 * Remembers the wall on this device so it comes back the next time this collection loads, and
 * reports pin changes (an older order could move an album that is now pinned, so the parent
 * resets Undo).
 *
 * @param input.username Collection the wall belongs to; nothing is saved without one.
 */
export function useRememberWall(input: {
  username: string;
  wall: SharedWallState;
  pinnedAlbums: Set<string>;
  onPinsChange?: (() => void) | undefined;
}) {
  const { username, wall, pinnedAlbums, onPinsChange } = input;
  const wallSignature = JSON.stringify(wall);

  const pinSignature = Array.from(pinnedAlbums).sort().join(",");
  const previousPinSignature = useRef(pinSignature);
  useEffect(() => {
    if (previousPinSignature.current === pinSignature) return;
    previousPinSignature.current = pinSignature;
    onPinsChange?.();
  }, [pinSignature, onPinsChange]);

  useEffect(() => {
    if (!username) return;
    try {
      const storage = localStore();
      if (storage) saveWall(storage, JSON.parse(wallSignature));
    } catch {
      // Storage is blocked; the wall just is not remembered.
    }
  }, [username, wallSignature]);
}
