import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // New in the React 19.2 lint rules. Six existing effects (the wall and pool sync in
    // RecordGrid, album image loading, shared-link loading, grid dimensions) set state from an
    // effect on purpose; they are reported as warnings until they are reworked as derived state.
    rules: { "react-hooks/set-state-in-effect": "warn" },
  },
  globalIgnores([".next/**", "out/**", "coverage/**", "next-env.d.ts"]),
]);
