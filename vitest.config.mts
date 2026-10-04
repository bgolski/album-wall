import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit and component tests. Next.js compiles the app itself; Vitest only needs
// the automatic JSX runtime and the "@/" import alias from tsconfig.json.
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
  },
});
