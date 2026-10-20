"use client";

import { useEffect } from "react";
import { getBasePath } from "@/utils/basePath";
import { IMAGE_SERVICE } from "@/utils/imageProxy";

/**
 * Registers the service worker that keeps the page, its files, public collections and covers
 * available on a bad or missing connection. Does nothing in development or where service workers
 * are unavailable.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const base = getBasePath();
    const query = new URLSearchParams();
    const collections = process.env.NEXT_PUBLIC_COLLECTION_CACHE_URL;
    if (collections) query.set("data", collections);
    if (IMAGE_SERVICE) query.set("img", IMAGE_SERVICE);

    const start = () => {
      navigator.serviceWorker
        .register(`${base}/sw.js?${query}`, { scope: `${base}/` })
        .then(async () => {
          // Files loaded before the worker took over are handed to it to keep.
          const worker = (await navigator.serviceWorker.ready).active;
          const urls = performance
            .getEntriesByType("resource")
            .map((entry) => entry.name)
            .filter((name) => name.includes("/_next/static/"));
          worker?.postMessage({ type: "keep", urls });
        })
        .catch(() => undefined);
    };
    // After the page has settled, so registering never competes with it.
    if (document.readyState === "complete") start();
    else {
      window.addEventListener("load", start, { once: true });
      return () => window.removeEventListener("load", start);
    }
  }, []);

  return null;
}
