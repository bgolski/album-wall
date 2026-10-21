import { defineConfig } from "@playwright/test";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";
const port = Number(process.env.PORT ?? 3100);

// Browser checks run against the static export (npm run build:static), served under its base path.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  // The checks often share the machine with other work (a build, a local model), where pages load
  // several times slower than usual; allow for that rather than fail on time alone.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? "github" : "list",
  // Reduced motion keeps the page still for the checks (no intro, no fading); the intro's own
  // test turns motion back on. The service worker is blocked so it cannot answer the requests the
  // checks stub; its own test allows it.
  use: {
    baseURL: `http://localhost:${port}${basePath}/`,
    reducedMotion: "reduce",
    serviceWorkers: "block",
  },
  webServer: {
    command: "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/serve-static.ts",
    url: `http://localhost:${port}${basePath}/`,
    reuseExistingServer: !process.env.CI,
  },
});
