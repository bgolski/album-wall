import { useState, useRef } from "react";
import { Album, Html2CanvasOptions } from "@/types";
import html2canvas from "html2canvas";

function escapeCsvField(value: string): string {
  const normalizedValue = value.replace(/"/g, '""');
  return `"${normalizedValue}"`;
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

      const canvas = await html2canvas(gridRef.current, {
        backgroundColor: "#121212",
        scale: window.devicePixelRatio * 2,
        logging: false,
        allowTaint: true,
        useCORS: true,
      } as Html2CanvasOptions);

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
   * Downloads the current album list as a CSV file using the album order passed to the hook.
   */
  const exportToCSV = () => {
    setDropdownOpen(false);
    setStatusMessage(null);

    if (!albums || albums.length === 0) {
      alert("No albums to export");
      return;
    }

    const csvHeader = "Artist,Title,Genre,Year,Discogs URL\n";
    const csvContent = albums
      .map((album) => {
        const artist = album.artist || "";
        const title = album.title || "";
        const genre = Array.isArray(album.genre) ? album.genre.join(" / ") : album.genre || "";
        const year = album.year || "";
        const discogsUrl = album.discogsUrl || "";

        return [artist, title, genre, year, discogsUrl].map(escapeCsvField).join(",");
      })
      .join("\n");

    const blob = new Blob([csvHeader + csvContent], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, "vinyl_wall_export.csv");
  };

  /**
   * Captures the current wall grid as a PNG image after temporarily hiding album labels.
   */
  const exportAsImage = async () => {
    setDropdownOpen(false);
    setStatusMessage(null);

    if (!gridRef.current || albums.length === 0) {
      alert("No albums to export");
      return;
    }

    try {
      setIsExporting(true);
      const imageBlob = await captureGridImageBlob();
      downloadBlob(imageBlob, `${userDisplayName}_vinyl_wall.png`);
    } catch (error) {
      console.error("Error exporting image:", error);
      alert("Failed to export image. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Shares the current wall image using the Web Share API when file sharing is supported.
   * Falls back to downloading the image when browser sharing is unavailable.
   */
  const shareImage = async () => {
    setDropdownOpen(false);
    setStatusMessage(null);

    if (!gridRef.current || albums.length === 0) {
      alert("No albums to share");
      return;
    }

    const filename = `${userDisplayName}_vinyl_wall.png`;

    try {
      setIsExporting(true);
      const imageBlob = await captureGridImageBlob();
      const imageFile = new File([imageBlob], filename, { type: "image/png" });

      if (
        typeof navigator !== "undefined" &&
        navigator.share &&
        (!navigator.canShare || navigator.canShare({ files: [imageFile] }))
      ) {
        await navigator.share({
          title: `${userDisplayName}'s Vinyl Wall`,
          text: `Check out ${userDisplayName}'s vinyl wall.`,
          files: [imageFile],
        });
        setStatusMessage("Image shared.");
        return;
      }

      downloadBlob(imageBlob, filename);
      setStatusMessage("Sharing not supported here. Downloaded the image instead.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatusMessage("Share canceled.");
        return;
      }

      console.error("Error sharing image:", error);
      setStatusMessage("Unable to share image.");
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
    exportToCSV,
    exportAsImage,
    shareImage,
    toggleDropdown,
  };
}
