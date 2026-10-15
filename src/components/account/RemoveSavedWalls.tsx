"use client";

import { useState, useSyncExternalStore } from "react";
import { SESSION_KEY, parseSession } from "@/utils/discogsSignIn";
import { savedWallsClient } from "@/utils/savedWalls";

/**
 * Removes everything the signed-in visitor keeps in their account (saved layouts and wall
 * history), after a confirmation. Copies in this browser stay. Signed out, it says how to sign in.
 */
export function RemoveSavedWalls() {
  // Read from this browser after it loads (the page itself is built ahead of time).
  const stored = useSyncExternalStore(
    () => () => undefined,
    () => {
      try {
        return window.localStorage.getItem(SESSION_KEY);
      } catch {
        return null;
      }
    },
    () => null
  );
  const session = parseSession(stored);
  const [state, setState] = useState<"idle" | "confirming" | "removing" | "done" | "failed">(
    "idle"
  );
  const [removed, setRemoved] = useState(0);

  if (!session) {
    return (
      <p className="text-sm">
        Sign in with Discogs on Album Wall to see or remove walls saved in your account.
      </p>
    );
  }

  const remove = async () => {
    const client = savedWallsClient(session);
    if (!client) return setState("failed");
    setState("removing");
    try {
      setRemoved(await client.removeAll());
      setState("done");
    } catch {
      setState("failed");
    }
  };

  const button =
    "rounded-control border border-line bg-raised px-3 py-2 text-sm font-medium text-ink hover:bg-line disabled:opacity-60";
  return (
    <div className="space-y-2" aria-live="polite">
      {state === "idle" && (
        <button type="button" className={button} onClick={() => setState("confirming")}>
          Remove my saved walls
        </button>
      )}
      {(state === "confirming" || state === "removing") && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink">
            Remove every layout and wall history saved for {session.username}?
          </span>
          <button
            type="button"
            className={`${button} border-danger text-danger`}
            onClick={() => void remove()}
            disabled={state === "removing"}
          >
            {state === "removing" ? "Removing…" : "Remove"}
          </button>
          <button type="button" className={button} onClick={() => setState("idle")}>
            Cancel
          </button>
        </div>
      )}
      {state === "done" && (
        <p className="text-sm text-ink">
          {removed === 0
            ? "Nothing was saved in your account."
            : `Removed ${removed} saved ${removed === 1 ? "item" : "items"} from your account.`}{" "}
          Copies in this browser stay.
        </p>
      )}
      {state === "failed" && (
        <p className="text-sm text-danger">Could not remove them right now. Please try again.</p>
      )}
    </div>
  );
}
