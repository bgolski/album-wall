/** Signing in with Discogs, as the header and the start screen show it. */
export interface DiscogsAccountProps {
  /** The signed-in Discogs username, or null. */
  username: string | null;
  /** A collection is loading. */
  busy: boolean;
  status: "idle" | "redirecting" | "finishing";
  error: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
  /** Loads the signed-in visitor's own collection. */
  onLoadOwn?: (() => void) | undefined;
}
