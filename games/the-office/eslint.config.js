import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["dist", "node_modules", "**/*.json", "**/*.css"]),
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.browser,
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@air-jam/sdk",
              importNames: ["useAirJamHost", "useAirJamController"],
              message:
                "Mount runtime owner hooks only in src/host/index.tsx or src/controller/index.tsx. Child components should use read-only session hooks.",
            },
          ],
          patterns: [
            {
              group: ["@air-jam/sdk"],
              importNames: ["useAirJamHost", "useAirJamController"],
              message:
                "Mount runtime owner hooks only in src/host/index.tsx or src/controller/index.tsx. Child components should use read-only session hooks.",
            },
          ],
        },
      ],
      ...prettierConfig.rules,
    },
  },
  {
    files: ["src/host/index.tsx", "src/controller/index.tsx"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
]);
