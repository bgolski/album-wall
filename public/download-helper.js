// This script helps improve html2canvas exports
document.addEventListener("DOMContentLoaded", function () {
  console.log("Download helper script loaded");

  // Create global function to handle album wall export
  window.exportAlbumWall = async function (
    gridSelector = "#grid-container",
    filename = "vinyl-wall.png"
  ) {
    console.log("Starting album wall export...");

    // Check if html2canvas is loaded
    if (typeof html2canvas !== "function") {
      console.error("html2canvas not loaded. Please try again later.");
      return;
    }

    // Get the wall display grid container (we only want to capture this part)
    const gridContainer = document.querySelector(gridSelector);
    if (!gridContainer) {
      console.error("Wall display grid container not found:", gridSelector);
      return;
    }

    try {
      // Set a flag to indicate we're in export mode
      const recordGridComponent = gridContainer.closest(".flex-col.gap-8")?.parentElement;
      if (recordGridComponent) {
        recordGridComponent.setAttribute("data-exporting", "true");
      }

      // Hide labels for clean export
      const labels = gridContainer.querySelectorAll(".album-labels");
      labels.forEach((label) => {
        label.style.display = "none";
      });

      // Pre-load all images as data URLs to avoid CORS issues
      const images = gridContainer.querySelectorAll("img");
      const imagePromises = [];

      for (let img of images) {
        if (img.complete && img.naturalWidth > 0) {
          // Image already loaded
          continue;
        }

        const promise = new Promise((resolve) => {
          const loadHandler = function () {
            img.removeEventListener("load", loadHandler);
            resolve();
          };

          img.addEventListener("load", loadHandler);

          // If already complete, resolve immediately
          if (img.complete) resolve();
        });

        imagePromises.push(promise);
      }

      // Wait for all images to be processed
      await Promise.all(imagePromises);

      // Wait a bit to ensure images are rendered
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Capture ONLY the wall display grid with html2canvas
      const canvas = await html2canvas(gridContainer, {
        backgroundColor: "#1a1a1a",
        scale: 2, // Higher quality
        useCORS: true,
        allowTaint: true,
        logging: true,
      });

      // Convert canvas to blob
      canvas.toBlob(function (blob) {
        if (!blob) {
          console.error("Failed to create blob from canvas");
          return;
        }

        // Create download link
        const link = document.createElement("a");
        link.download = filename;
        link.href = URL.createObjectURL(blob);
        link.click();

        // Clean up
        URL.revokeObjectURL(link.href);

        console.log("Export complete!");

        // Restore labels visibility
        labels.forEach((label) => {
          label.style.display = "";
        });

        // Remove export flag
        if (recordGridComponent) {
          recordGridComponent.removeAttribute("data-exporting");
        }
      }, "image/png");
    } catch (error) {
      console.error("Export failed:", error);

      // Restore labels visibility in case of error
      const labels = gridContainer.querySelectorAll(".album-labels");
      labels.forEach((label) => {
        label.style.display = "";
      });

      // Make sure to remove export flag in case of error
      const recordGridComponent = gridContainer.closest(".flex-col.gap-8")?.parentElement;
      if (recordGridComponent) {
        recordGridComponent.removeAttribute("data-exporting");
      }
    }
  };
});
