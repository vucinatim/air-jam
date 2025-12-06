import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "**/*.json",
    "**/*.css",
  ]),
  // Disable ESLint rules that conflict with Prettier
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    rules: {
      ...prettierConfig.rules,
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
    },
  },
]);

export default eslintConfig;
