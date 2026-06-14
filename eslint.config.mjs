import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Default ignores of eslint-config-next.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "lib/api/generated/**"]),
  {
    rules: {
      // Common hydration-guard patterns (`setMounted(true)` inside an effect,
      // `setIsMobile(window.innerWidth < BP)` after `addEventListener`) are
      // intentional and recommended by next-themes / shadcn. Demote to warning
      // so they don't fail CI while still surfacing genuine misuse.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
