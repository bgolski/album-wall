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
    // Component tests often run while the machine is busy (a build, a local model), where they
    // take several times longer; allow for that rather than fail on time alone.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
  },
});
