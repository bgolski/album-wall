import { useState, useRef, type Dispatch, type SetStateAction } from "react";
import { wallDisplayName } from "@/utils/demoCollection";
import { Album } from "@/types";
import { fitIntoFrame, type ExportBackdrop, type ExportPreset } from "@/utils/exportFrame";
import { drawRecordBackground } from "@/utils/recordBackground";
import { PosterError, requestPoster, type PosterSize } from "@/utils/posterService";
import { drawWall } from "@/utils/drawWall";
import { makeGuide } from "@/utils/guide";
import { paperFor } from "@/utils/guideLayout";
import { DEFAULT_PLACEHOLDER_IMAGE } from "@/utils/imageProxy";
import { downloadBlob } from "@/utils/download";
import { isAbortError } from "@/utils/errors";
import type { ToastState } from "@/components/ui/Toast";

const EXPORT_TIMEOUT_MS = 20000;
// Largest canvas side to capture; browsers on phones refuse much bigger canvases.
const MAX_CAPTURE_SIDE = 4096;
// Pixels in an image saved at the screen's own size, on any device: an 8 x 4 wall comes to about
// 2450 x 1225, roughly 290 pixels per cover, so a phone saves as sharp an image as a computer.
const EXPORT_PIXELS = 3_000_000;

/**
 * The wall panel's current background, so an exported image matches light or dark mode.
 */
function getPanelColor(grid: HTMLElement) {
  return getComputedStyle(grid.parentElement ?? grid).backgroundColor || "#121212";
}

/**
 * How much to enlarge the wall when saving it at the screen's own size. The image is sized by a
 * pixel budget rather than the screen, because a phone shows the wall only a few hundred pixels
 * wide and saving it at that size leaves each cover tiny.
 *
 * @param gridWidth Width of the wall on screen, in CSS pixels.
 * @param gridHeight Height of the wall on screen, in CSS pixels.
 */
function getExportScale(gridWidth: number, gridHeight: number) {
  return Math.max(
    1,
    Math.min(
      Math.sqrt(EXPORT_PIXELS / (gridWidth * gridHeight)),
      MAX_CAPTURE_SIDE / Math.max(gridWidth, gridHeight)
    )
  );
}

/**
 * Draws a captured wall centred on a canvas of a preset's size, filled with the panel colour.
 *
 * @param padding Empty margin kept on every side, in output pixels.
 * @param backdrop What is behind the wall: a colour, and the record over it when asked.
 * @returns A canvas of exactly the preset size.
 */
function drawInFrame(
  source: HTMLCanvasElement,
  preset: ExportPreset,
  padding: number,
  backdrop: ExportBackdrop
) {
  const frame = document.createElement("canvas");
  frame.width = preset.width;
  frame.height = preset.height;
  const context = frame.getContext("2d");
  if (!context) throw new Error("Canvas drawing is not available");
  context.fillStyle = backdrop.color;
  context.fillRect(0, 0, preset.width, preset.height);
  if (backdrop.record) drawRecordBackground(context, preset.width, preset.height);
  const fit = fitIntoFrame(source.width, source.height, preset.width, preset.height, padding);
  context.drawImage(source, fit.x, fit.y, fit.width, fit.height);
  return frame;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      window.setTimeout(() => {
        reject(new Error("Export timed out."));
      }, timeoutMs);
    }),
  ]);
}

/**
 * Manages export UI state and provides the image export, guide export and share-link actions for
 * the current wall.
 */
export function useGridExport(
  username: string,
  albums: Album[],
  show: Dispatch<SetStateAction<ToastState | null>>
) {
  const [isExporting, setIsExporting] = useState(false);
  const setStatusMessage = (message: string | null) =>
    show(message ? { message, tone: "info" } : null);

  const gridRef = useRef<HTMLDivElement>(null);

  const userDisplayName = wallDisplayName(username) || "Anonymous";
  const imageFilenameFor = (preset?: ExportPreset) =>
    `${userDisplayName}_album_wall${preset ? `_${preset.id}` : ""}.png`;
  const guideFilename = `${userDisplayName}_album_wall_guide.pdf`;

  /**
   * Returns true when the current browser can share the file natively.
   *
   * @param file File to check against the Web Share API.
   * @returns Whether file sharing is supported for this file.
   */
  const canShareFile = (file: File) => {
    return (
      typeof navigator !== "undefined" &&
      Boolean(navigator.share) &&
      (!navigator.canShare || navigator.canShare({ files: [file] }))
    );
  };

  /**
   * Draws the current wall into a PNG blob.
   *
   * @param preset Output size; without one the image is the wall at the screen's density.
   * @param backdrop What is behind the wall; without one it matches the wall's panel.
   * @returns A PNG blob for the current wall grid, and how many covers had to be left out.
   */
  const captureGridImageBlob = async (preset?: ExportPreset, backdrop?: ExportBackdrop) => {
    if (!gridRef.current) {
      throw new Error("No grid available to export");
    }
    const grid = gridRef.current;
    const color = backdrop?.color ?? getPanelColor(grid);
    // Over the record the wall is drawn on nothing, so the record shows between the covers.
    const background = backdrop?.record && preset ? "rgba(0, 0, 0, 0)" : color;
    const padding = preset ? Math.round(Math.min(preset.width, preset.height) * 0.05) : 0;
    // Capture a preset at the resolution it is drawn at, so a narrow wall on a phone is not
    // stretched, but keep the capture within a canvas size phones can render.
    const gridWidth = grid.offsetWidth || 1;
    const gridHeight = grid.offsetHeight || 1;
    const scale = preset
      ? Math.max(
          1,
          Math.min(
            (preset.width - 2 * padding) / gridWidth,
            (preset.height - 2 * padding) / gridHeight,
            MAX_CAPTURE_SIDE / Math.max(gridWidth, gridHeight)
          )
        )
      : getExportScale(gridWidth, gridHeight);

    const { canvas, left } = await withTimeout(
      drawWall({ grid, albums, scale, background, placeholder: DEFAULT_PLACEHOLDER_IMAGE }),
      EXPORT_TIMEOUT_MS
    );
    const output = preset
      ? drawInFrame(canvas, preset, padding, { color, record: backdrop?.record ?? false })
      : canvas;
    const imageBlob = await new Promise<Blob>((resolve, reject) => {
      output.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Failed to generate image blob"));
          return;
        }

        resolve(blob);
      }, "image/png");
    });
    return { imageBlob, coversLeftOut: left };
  };

  /**
   * Attempts to share a file using the browser's native share sheet.
   *
   * @returns True when the share sheet was used successfully, otherwise false.
   */
  const tryNativeShare = async (file: File) => {
    if (!canShareFile(file)) {
      return false;
    }

    await navigator.share({
      title: `${userDisplayName}'s Album Wall`,
      text: `Check out ${userDisplayName}'s album wall.`,
      files: [file],
    });

    return true;
  };

  /**
   * Makes a file of the wall and routes it through the best available share/save path for the
   * current device: the share sheet where there is one, a download otherwise.
   *
   * @param work What is being made: the notice while it is, and the notice if it fails.
   * @param make Makes the file, and says how many covers it had to leave out.
   */
  const deliver = async (
    work: { preparing: string; failed: string },
    make: () => Promise<{ blob: Blob; filename: string; coversLeftOut: number }>
  ) => {
    setStatusMessage(null);

    try {
      setIsExporting(true);
      show({ message: work.preparing, tone: "info", busy: true });
      const { blob, filename, coversLeftOut: missing } = await make();
      const file = new File([blob], filename, { type: blob.type });
      const leftOut = missing > 0 ? `, ${missing} left out` : "";
      const savedMessage = `Saved${leftOut}`;

      try {
        if (await tryNativeShare(file)) {
          if (missing > 0) setStatusMessage(`Shared${leftOut}`);
          return;
        }
      } catch (error) {
        // Safari only opens the share sheet right after a tap, and capturing the wall takes a
        // while. Offer a button so the share happens from a fresh tap instead of failing.
        if (error instanceof DOMException && error.name === "NotAllowedError") {
          show({
            message: "Ready",
            tone: "info",
            action: {
              label: "Share",
              run: () => {
                void tryNativeShare(file).catch((shareError) => {
                  if (isAbortError(shareError)) return;
                  console.error("Error sharing file:", shareError);
                  downloadBlob(blob, filename);
                  setStatusMessage("Saved");
                });
              },
            },
          });
          return;
        }
        throw error;
      }

      downloadBlob(blob, filename);
      setStatusMessage(savedMessage);
    } catch (error) {
      if (isAbortError(error)) {
        setStatusMessage("Canceled");
        return;
      }

      console.error("Error exporting:", error);
      // A poster says why in its own words (used up for the day, service unreachable).
      show({
        message: error instanceof PosterError ? error.message : work.failed,
        tone: "error",
      });
    } finally {
      setIsExporting(false);
      // A share that needed no message leaves the progress notice up; clear it.
      show((current) => (current?.busy ? null : current));
    }
  };

  /**
   * Captures the current wall grid as a PNG image and routes it through the best available
   * share/save path for the current device.
   *
   * @param preset Output size, such as a phone wallpaper; without one the wall is saved as shown.
   * @param backdrop What is behind the wall; without one it matches the wall's panel.
   */
  const shareOrSaveImage = async (preset?: ExportPreset, backdrop?: ExportBackdrop) => {
    if (!gridRef.current || albums.length === 0) {
      show({ message: "No albums", tone: "error" });
      return;
    }
    await deliver(
      { preparing: "Preparing image...", failed: "Could not save the image" },
      async () => {
        const { imageBlob, coversLeftOut } = await captureGridImageBlob(preset, backdrop);
        return { blob: imageBlob, filename: imageFilenameFor(preset), coversLeftOut };
      }
    );
  };

  /**
   * Makes the hanging guide, a PDF of the wall with its rows and columns numbered and the records
   * listed, and shares or saves it.
   *
   * @param wall What is on the wall, in order, and its shape.
   * @param changes Steps to change the wall hung last time into this one, to add to the guide.
   */
  const saveGuide = async (
    wall: { albums: Album[]; rows: number; columns: number },
    changes?: { since: string; lines: string[] }
  ) => {
    if (!gridRef.current || wall.albums.length === 0) {
      show({ message: "No albums", tone: "error" });
      return;
    }
    const grid = gridRef.current;
    await deliver(
      { preparing: "Preparing guide...", failed: "Could not save the guide" },
      async () => {
        const { pdf, coversLeftOut } = await withTimeout(
          makeGuide({
            grid,
            albums: wall.albums,
            rows: wall.rows,
            columns: wall.columns,
            title: `${userDisplayName}'s wall`,
            paper: paperFor(typeof navigator === "undefined" ? undefined : navigator.language),
            placeholder: DEFAULT_PLACEHOLDER_IMAGE,
            ...(changes ? { changes } : {}),
          }),
          EXPORT_TIMEOUT_MS * 2
        );
        return { blob: pdf, filename: guideFilename, coversLeftOut };
      }
    );
  };

  /**
   * Has the poster service draw the wall at print size, and shares or saves it. The poster is
   * made the same way whatever the device, so a phone gets the same file as a computer.
   *
   * @param wall What is on the wall, in order, and its shape.
   * @param options The poster's size and what is behind the wall.
   */
  const savePoster = async (
    wall: { albums: Album[]; rows: number; columns: number },
    options: { size: PosterSize; background: "dark" | "light" | "record" }
  ) => {
    if (wall.albums.length === 0) {
      show({ message: "No albums", tone: "error" });
      return;
    }
    await deliver(
      { preparing: "Preparing poster...", failed: "Could not make the poster" },
      async () => {
        const { blob, coversLeftOut } = await requestPoster({ ...wall, ...options });
        return {
          blob,
          filename: `${userDisplayName}_album_wall_poster_${options.size}.jpg`,
          coversLeftOut,
        };
      }
    );
  };

  return {
    isExporting,
    gridRef,
    shareOrSaveImage,
    saveGuide,
    savePoster,
  };
}
