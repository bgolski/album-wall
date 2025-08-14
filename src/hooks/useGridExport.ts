import { useState, useRef } from "react";
import { Album, Html2CanvasOptions } from "@/types";
import html2canvas from "html2canvas";

export function useGridExport(username: string, albums: Album[]) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const userDisplayName = username || "Anonymous";

  const exportToCSV = () => {
    setDropdownOpen(false);

    if (!albums || albums.length === 0) {
      alert("No albums to export");
      return;
    }

    const csvHeader = "Artist,Title,Genre,Year\n";
    const csvContent = albums
      .map((album) => {
        const artist = album.artist.replace(/,/g, " ");
        const title = album.title.replace(/,/g, " ");
        const genre =
          album.genre && album.genre.length > 0 ? album.genre[0].replace(/,/g, " ") : "";
        const year = album.year || "";
        return `${artist},${title},${genre},${year}`;
      })
      .join("\n");

    const blob = new Blob([csvHeader + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.setAttribute("href", url);
    link.setAttribute("download", "vinyl_wall_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportAsImage = async () => {
    setDropdownOpen(false);

    if (!gridRef.current || albums.length === 0) {
      alert("No albums to export");
      return;
    }

    try {
      setIsExporting(true);

      // Temporarily hide labels for export
      const labels = gridRef.current.querySelectorAll(".album-labels");
      labels.forEach((label: Element) => {
        (label as HTMLElement).style.display = "none";
      });

      const canvas = await html2canvas(gridRef.current, {
        backgroundColor: "#121212",
        scale: window.devicePixelRatio * 2,
        logging: false,
        allowTaint: true,
        useCORS: true,
      } as Html2CanvasOptions);

      // Show labels again
      labels.forEach((label: Element) => {
        (label as HTMLElement).style.display = "block";
      });

      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `${userDisplayName}_vinyl_wall.png`;
      link.href = image;
      link.click();

      setIsExporting(false);
    } catch (error) {
      console.error("Error exporting image:", error);
      alert("Failed to export image. Please try again.");
      setIsExporting(false);
    }
  };

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  return {
    dropdownOpen,
    isExporting,
    gridRef,
    exportToCSV,
    exportAsImage,
    toggleDropdown,
  };
}
