import { useEffect, useState, useRef } from "react";
import { Album, Html2CanvasOptions } from "@/types";
import { fitIntoFrame, type ExportPreset } from "@/utils/exportFrame";

const EXPORT_TIMEOUT_MS = 20000;
const STATUS_VISIBLE_MS = 4000;
const ACTION_VISIBLE_MS = 15000;

export interface ExportStatus {
  message: string;
  tone: "info" | "error";
  action?: { label: string; run: () => void };
}

function isTouchDevice() {
  return (
    typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0)
  );
}

/**
 * The wall panel's current background, so an exported image matches light or dark mode.
 *
 * @param grid The wall grid element being captured.
 * @returns A CSS color string.
 */
function getPanelColor(grid: HTMLElement) {
  return getComputedStyle(grid.parentElement ?? grid).backgroundColor || "#121212";
}

function getExportScale() {
  if (typeof window === "undefined") {
    return 2;
  }

  return isTouchDevice() ? Math.min(window.devicePixelRatio, 2) : window.devicePixelRatio * 2;
}

/**
 * Draws a captured wall centred on a canvas of a preset's size, filled with the panel colour.
 *
 * @param source The captured wall.
 * @param preset Output size.
 * @param padding Empty margin kept on every side, in output pixels.
 * @param background Fill colour around the wall.
 * @returns A canvas of exactly the preset size.
 */
function drawInFrame(
  source: HTMLCanvasElement,
  preset: ExportPreset,
  padding: number,
  background: string
) {
  const frame = document.createElement("canvas");
  frame.width = preset.width;
  frame.height = preset.height;
  const context = frame.getContext("2d");
  if (!context) throw new Error("Canvas drawing is not available");
  context.fillStyle = background;
  context.fillRect(0, 0, preset.width, preset.height);
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

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Manages export UI state and provides the image export and share-link actions for the current wall.
 *
 * @param username Discogs username used in exported filenames.
 * @param albums Albums to include in export output.
 * @returns Export dropdown state, grid ref, and export handlers.
 */
export function useGridExport(username: string, albums: Album[]) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [status, setStatus] = useState<ExportStatus | null>(null);
  const setStatusMessage = (message: string | null) =>
    setStatus(message ? { message, tone: "info" } : null);

  // A toast goes away on its own; one that offers an action stays longer so it can be used.
  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(
      () => setStatus(null),
      status.action ? ACTION_VISIBLE_MS : STATUS_VISIBLE_MS
    );
    return () => window.clearTimeout(timer);
  }, [status]);
  const gridRef = useRef<HTMLDivElement>(null);

  const userDisplayName = username || "Anonymous";
  const imageFilenameFor = (preset?: ExportPreset) =>
    `${userDisplayName}_vinyl_wall${preset ? `_${preset.id}` : ""}.png`;

  /**
   * Returns true when the current browser can share image files natively.
   *
   * @param imageFile Image file to check against the Web Share API.
   * @returns Whether file sharing is supported for this image.
   */
  const canShareImageFile = (imageFile: File) => {
    return (
      typeof navigator !== "undefined" &&
      Boolean(navigator.share) &&
      (!navigator.canShare || navigator.canShare({ files: [imageFile] }))
    );
  };

  /**
   * Captures the current wall grid into a PNG blob while preserving existing label visibility.
   *
   * @param preset Output size; without one the image is the wall at the screen's density.
   * @returns A PNG blob for the current wall grid.
   */
  const captureGridImageBlob = async (preset?: ExportPreset) => {
    if (!gridRef.current) {
      throw new Error("No grid available to export");
    }
    const grid = gridRef.current;
    const background = getPanelColor(grid);
    const padding = preset ? Math.round(Math.min(preset.width, preset.height) * 0.05) : 0;
    // Capture a preset at about the resolution it is drawn at, within what a phone can render.
    const scale = preset
      ? Math.min(
          4,
          Math.max(
            1,
            Math.min(
              (preset.width - 2 * padding) / (grid.offsetWidth || 1),
              (preset.height - 2 * padding) / (grid.offsetHeight || 1)
            )
          )
        )
      : getExportScale();

    const labels = Array.from(gridRef.current.querySelectorAll<HTMLElement>(".album-labels"));
    const previousDisplayValues = labels.map((label) => label.style.display);

    try {
      labels.forEach((label) => {
        label.style.display = "none";
      });

      const { default: html2canvas } = await import("html2canvas-pro");

      const canvas = await withTimeout(
        Promise.resolve(
          html2canvas(grid, {
            backgroundColor: background,
            scale,
            logging: false,
            allowTaint: true,
            useCORS: true,
          } as Html2CanvasOptions)
        ),
        EXPORT_TIMEOUT_MS
      );

      const output = preset ? drawInFrame(canvas, preset, padding, background) : canvas;
      return await new Promise<Blob>((resolve, reject) => {
        output.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Failed to generate image blob"));
            return;
          }

          resolve(blob);
        }, "image/png");
      });
    } finally {
      labels.forEach((label, index) => {
        label.style.display = previousDisplayValues[index] ?? "";
      });
    }
  };

  /**
   * Attempts to share an image file using the browser's native share sheet.
   *
   * @param imageFile Image file to share.
   * @returns True when the share sheet was used successfully, otherwise false.
   */
  const tryNativeImageShare = async (imageFile: File) => {
    if (!canShareImageFile(imageFile)) {
      return false;
    }

    await navigator.share({
      title: `${userDisplayName}'s Vinyl Wall`,
      text: `Check out ${userDisplayName}'s vinyl wall.`,
      files: [imageFile],
    });

    return true;
  };

  /**
   * Captures the current wall grid as a PNG image and routes it through the best available
   * share/save path for the current device.
   *
   * @param preset Output size, such as a phone wallpaper; without one the wall is saved as shown.
   */
  const shareOrSaveImage = async (preset?: ExportPreset) => {
    const imageFilename = imageFilenameFor(preset);
    setDropdownOpen(false);
    setStatusMessage(null);

    if (!gridRef.current || albums.length === 0) {
      setStatus({ message: "No albums to share.", tone: "error" });
      return;
    }

    try {
      setIsExporting(true);
      const imageBlob = await captureGridImageBlob(preset);
      const imageFile = new File([imageBlob], imageFilename, { type: "image/png" });

      try {
        if (await tryNativeImageShare(imageFile)) return;
      } catch (error) {
        // Safari only opens the share sheet right after a tap, and capturing the wall takes a
        // while. Offer a button so the share happens from a fresh tap instead of failing.
        if (error instanceof DOMException && error.name === "NotAllowedError") {
          setStatus({
            message: "Image ready.",
            tone: "info",
            action: {
              label: "Share image",
              run: () => {
                void tryNativeImageShare(imageFile).catch((shareError) => {
                  if (shareError instanceof DOMException && shareError.name === "AbortError")
                    return;
                  console.error("Error sharing image:", shareError);
                  downloadBlob(imageBlob, imageFilename);
                  setStatusMessage("Image saved.");
                });
              },
            },
          });
          return;
        }
        throw error;
      }

      downloadBlob(imageBlob, imageFilename);
      setStatusMessage("Image saved.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatusMessage("Save canceled.");
        return;
      }

      console.error("Error exporting image:", error);
      setStatus({ message: "Failed to export image. Please try again.", tone: "error" });
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Toggles visibility of the export dropdown menu.
   */
  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  const closeDropdown = () => setDropdownOpen(false);

  return {
    dropdownOpen,
    isExporting,
    status,
    setStatus,
    closeDropdown,
    gridRef,
    shareOrSaveImage,
    toggleDropdown,
  };
}
