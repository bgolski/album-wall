import { defineConfig } from "@playwright/test";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";
const port = Number(process.env.PORT ?? 3100);

// Browser checks run against the static export (npm run build:static), served under its base path.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${port}${basePath}/` },
  webServer: {
    command: "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/serve-static.ts",
    url: `http://localhost:${port}${basePath}/`,
    reuseExistingServer: !process.env.CI,
  },
});
