import { useEffect, useState } from "react";
import { DiscogsFolder, DiscogsSession, getCollectionFolders } from "@/utils/discogsSignIn";

/**
 * The signed-in visitor's collection folders, loaded once per sign-in.
 *
 * @param session The signed-in visitor, or null.
 * @returns The folders (empty until they load, or when signed out).
 */
export function useDiscogsFolders(session: DiscogsSession | null) {
  const [loaded, setLoaded] = useState<{ token: string; folders: DiscogsFolder[] } | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    getCollectionFolders(session)
      .then((folders) => {
        if (!cancelled) setLoaded({ token: session.token, folders });
      })
      .catch(() => {
        // The picker stays hidden; the whole collection still loads.
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  return session && loaded?.token === session.token ? loaded.folders : [];
}
