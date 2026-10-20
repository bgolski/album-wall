import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useDiscogsSignIn } from "./useDiscogsSignIn";
import { PENDING_KEY, SESSION_KEY, saveSession } from "@/utils/discogsSignIn";
import { writeCachedCollection } from "@/utils/collectionCache";

const SESSION = { username: "Collector", token: "accesstoken", secret: "accesssecret" };

function setAddress(path: string) {
  window.history.replaceState(null, "", path);
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_DISCOGS_PROXY_URL", "https://proxy.example/");
  setAddress("/album-wall/");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("useDiscogsSignIn", () => {
  it("signing out forgets the token and what was loaded with it", () => {
    saveSession(localStorage, SESSION);
    writeCachedCollection(sessionStorage, "Collector", [], Date.now());
    const { result } = renderHook(() => useDiscogsSignIn());
    expect(result.current.session).toEqual(SESSION);

    act(() => result.current.signOut());

    expect(result.current.session).toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(sessionStorage.getItem("album-wall:collection:collector")).toBeNull();
  });

  it("finishes the sign-in when Discogs sends the visitor back", async () => {
    sessionStorage.setItem(
      PENDING_KEY,
      JSON.stringify({ token: "req", secret: "reqsecret", returnHash: "" })
    );
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(SESSION)));
    vi.stubGlobal("fetch", fetchMock);
    setAddress("/album-wall/?oauth_token=req&oauth_verifier=ver");

    const { result } = renderHook(() => useDiscogsSignIn());

    await waitFor(() => expect(result.current.session).toEqual(SESSION));
    expect(result.current.justSignedIn).toBe("Collector");
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({
      token: "req",
      secret: "reqsecret",
      verifier: "ver",
    });
    expect(window.location.search).toBe("");
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it("puts back the shared wall the visitor signed in from", async () => {
    sessionStorage.setItem(
      PENDING_KEY,
      JSON.stringify({ token: "req", secret: "reqsecret", returnHash: "#share=abc" })
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(SESSION))));
    setAddress("/album-wall/?oauth_token=req&oauth_verifier=ver");

    const { result } = renderHook(() => useDiscogsSignIn());

    await waitFor(() => expect(result.current.session).toEqual(SESSION));
    expect(window.location.hash).toBe("#share=abc");
    // The shared wall loads instead of the visitor's own collection.
    expect(result.current.justSignedIn).toBeNull();
  });

  it("refuses an answer for a sign-in this tab did not start", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    setAddress("/album-wall/?oauth_token=other&oauth_verifier=ver");

    const { result } = renderHook(() => useDiscogsSignIn());

    await waitFor(() => expect(result.current.error).toMatch(/Sign-in failed/));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.session).toBeNull();
  });

  it("says when the visitor cancelled on Discogs", async () => {
    setAddress("/album-wall/?denied=req");
    const { result } = renderHook(() => useDiscogsSignIn());
    await waitFor(() => expect(result.current.error).toMatch(/cancelled/));
    expect(window.location.search).toBe("");
  });

  it("holds the request token in this tab, then goes to Discogs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            authorizeUrl: "https://www.discogs.com/oauth/authorize?oauth_token=req",
            token: "req",
            secret: "reqsecret",
          })
        )
      )
    );
    const assign = vi.fn();
    setAddress("/album-wall/#share=abc");

    const { result } = renderHook(() => useDiscogsSignIn(assign));
    await act(() => result.current.signIn());

    expect(assign).toHaveBeenCalledWith("https://www.discogs.com/oauth/authorize?oauth_token=req");
    expect(JSON.parse(sessionStorage.getItem(PENDING_KEY)!)).toEqual({
      token: "req",
      secret: "reqsecret",
      returnHash: "#share=abc",
    });
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });
});
