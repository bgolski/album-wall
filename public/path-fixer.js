// This script helps fix common path issues on GitHub Pages
(function () {
  // Get the base path from the meta tag
  const basePath =
    document.querySelector('meta[name="base-path"]')?.getAttribute("content") ||
    "";

  // Function to fix broken script and stylesheet paths
  function fixPaths() {
    // Fix script paths
    document.querySelectorAll('script[src^="/"]').forEach((script) => {
      if (
        !script.src.includes(basePath) &&
        !script.hasAttribute("data-fixed")
      ) {
        script.src = basePath + script.getAttribute("src");
        script.setAttribute("data-fixed", "true");
      }
    });

    // Fix stylesheet paths
    document
      .querySelectorAll('link[rel="stylesheet"][href^="/"]')
      .forEach((link) => {
        if (!link.href.includes(basePath) && !link.hasAttribute("data-fixed")) {
          link.href = basePath + link.getAttribute("href");
          link.setAttribute("data-fixed", "true");
        }
      });
  }

  // Fix paths on DOMContentLoaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fixPaths);
  } else {
    fixPaths();
  }

  // Also fix paths on load
  window.addEventListener("load", fixPaths);
})();
