import { useRef } from "react";
import type { SharedWallState } from "@/types";
import type { ToastState } from "@/components/ui/Toast";
import { isAbortError } from "@/utils/errors";
import { buildSharedWallUrl, encodeSharedWallState } from "@/utils/shareState";
import { copyLink } from "@/utils/copyText";
import { wallDisplayName } from "@/utils/demoCollection";
import { requestShortLink } from "@/utils/shortLink";

/**
 * Sharing the wall as a link: through the device's share sheet, or copied to the clipboard (with
 * a fallback box when the clipboard refuses). A short link that shows the wall in message
 * previews is asked for when the export panel opens (`prepare`), so it is usually ready by the
 * time a share is chosen; until it is, or if it cannot be made, the long link is used.
 *
 * @param input.username Collection the wall belongs to; no link is built without one.
 * @param input.wall The wall as shown.
 * @param input.covers Cover image addresses of the wall, in order, for the preview picture.
 * @param input.setStatus Shows the outcome.
 * @returns `prepare`, `shareLink` and `copyShareLink`.
 */
export function useShareLinks(input: {
  username: string;
  wall: SharedWallState;
  covers: string[];
  setStatus: (status: ToastState | null) => void;
}) {
  const { username, wall, covers, setStatus } = input;
  // Short links by long link: requests under way, and the ones that came back.
  const pending = useRef(new Map<string, Promise<string | null>>());
  const ready = useRef(new Map<string, string>());

  const buildShareUrl = () => {
    if (typeof window === "undefined" || !username) return null;
    return buildSharedWallUrl(wall, window.location.href);
  };

  /**
   * Starts asking for the current wall's short link, once per wall.
   */
  const prepare = () => {
    const longUrl = buildShareUrl();
    if (!longUrl || pending.current.has(longUrl)) return;
    const request = requestShortLink({
      payload: encodeSharedWallState(wall),
      app: `${window.location.origin}${window.location.pathname}`,
      title: `${wallDisplayName(username)}'s Album Wall`,
      rows: wall.rows,
      columns: wall.columns,
      covers,
    }).then((shortUrl) => {
      if (shortUrl) ready.current.set(longUrl, shortUrl);
      else pending.current.delete(longUrl);
      return shortUrl;
    });
    pending.current.set(longUrl, request);
  };

  /**
   * The link to share: the short one when it is ready, after waiting for one under way.
   *
   * @param longUrl The wall's long link.
   * @returns The short link, or the long one.
   */
  const resolveUrl = async (longUrl: string) => {
    prepare();
    return (await pending.current.get(longUrl)) ?? longUrl;
  };

  /**
   * Copies the wall's share link to the clipboard.
   */
  const copyShareLink = async () => {
    const longUrl = buildShareUrl();
    if (!longUrl) {
      setStatus({ message: "Link not ready", tone: "error" });
      return;
    }

    // Safari copies only straight after a tap, so a ready link is copied without waiting.
    const shareUrl = ready.current.get(longUrl) ?? (await resolveUrl(longUrl));
    const outcome = await copyLink(shareUrl);
    setStatus({
      message: outcome === "copied" ? "Link copied" : "Copy it from the box",
      tone: "info",
    });
  };

  /**
   * Opens the device's share sheet with the wall's share link, copying it instead if that fails.
   */
  const shareLink = async () => {
    const longUrl = buildShareUrl();
    if (!longUrl) {
      setStatus({ message: "Link not ready", tone: "error" });
      return;
    }

    const share = (url: string) =>
      navigator.share({
        title: `${wallDisplayName(username)}'s Album Wall`,
        text: `Check out ${wallDisplayName(username)}'s album wall.`,
        url,
      });

    const readyUrl = ready.current.get(longUrl);
    const shareUrl = readyUrl ?? (await resolveUrl(longUrl));
    try {
      await share(shareUrl);
    } catch (error) {
      if (isAbortError(error)) return;
      // Safari opens the share sheet only straight after a tap; waiting for the short link can
      // use that up, so offer a button that shares from a fresh tap.
      if (!readyUrl && error instanceof DOMException && error.name === "NotAllowedError") {
        setStatus({
          message: "Link ready",
          tone: "info",
          action: { label: "Share", run: () => void share(shareUrl).catch(() => {}) },
        });
        return;
      }
      console.error("Error sharing link:", error);
      await copyShareLink();
    }
  };

  return { prepare, shareLink, copyShareLink };
}
