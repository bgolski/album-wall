import { useState, useRef } from "react";
import { Album, Html2CanvasOptions } from "@/types";
import html2canvas from "html2canvas";

const EXPORT_TIMEOUT_MS = 20000;

function isTouchDevice() {
  return (
    typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0)
  );
}

function getExportScale() {
  if (typeof window === "undefined") {
    return 2;
  }

  return isTouchDevice() ? Math.min(window.devicePixelRatio, 2) : window.devicePixelRatio * 2;
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
 * Manages export UI state and provides CSV and image export actions for the current wall.
 *
 * @param username Discogs username used in exported filenames.
 * @param albums Albums to include in export output.
 * @returns Export dropdown state, grid ref, and export handlers.
 */
export function useGridExport(username: string, albums: Album[]) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const userDisplayName = username || "Anonymous";
  const imageFilename = `${userDisplayName}_vinyl_wall.png`;

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
   * @returns A PNG blob for the current wall grid.
   */
  const captureGridImageBlob = async () => {
    if (!gridRef.current) {
      throw new Error("No grid available to export");
    }

    const labels = Array.from(gridRef.current.querySelectorAll<HTMLElement>(".album-labels"));
    const previousDisplayValues = labels.map((label) => label.style.display);

    try {
      labels.forEach((label) => {
        label.style.display = "none";
      });

      const canvas = await withTimeout(
        Promise.resolve(
          html2canvas(gridRef.current, {
            backgroundColor: "#121212",
            scale: getExportScale(),
            logging: false,
            allowTaint: true,
            useCORS: true,
          } as Html2CanvasOptions)
        ),
        EXPORT_TIMEOUT_MS
      );

      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Failed to generate image blob"));
            return;
          }

          resolve(blob);
        }, "image/png");
      });
    } finally {
      labels.forEach((label, index) => {
        label.style.display = previousDisplayValues[index];
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
   */
  const shareOrSaveImage = async () => {
    setDropdownOpen(false);
    setStatusMessage(null);

    if (!gridRef.current || albums.length === 0) {
      alert("No albums to share");
      return;
    }

    try {
      setIsExporting(true);
      const imageBlob = await captureGridImageBlob();
      const imageFile = new File([imageBlob], imageFilename, { type: "image/png" });

      if (await tryNativeImageShare(imageFile)) {
        setStatusMessage("Use the share sheet to save or send the image.");
        return;
      }

      downloadBlob(imageBlob, imageFilename);
      setStatusMessage("Image saved.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatusMessage("Save canceled.");
        return;
      }

      console.error("Error exporting image:", error);
      alert("Failed to export image. Please try again.");
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

  return {
    dropdownOpen,
    isExporting,
    statusMessage,
    gridRef,
    shareOrSaveImage,
    toggleDropdown,
  };
}
