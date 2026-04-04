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
    ignores: ["dist", "node_modules"],
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
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      ...prettierConfig.rules,
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    ignores: [
      "dist",
      "node_modules",
      "src/routes/host-view.tsx",
      "src/routes/controller-view.tsx",
      "src/host/index.tsx",
      "src/controller/index.tsx",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@air-jam/sdk",
              importNames: [
                "AirJamHostRuntime",
                "AirJamControllerRuntime",
                "HostSessionProvider",
                "ControllerSessionProvider",
              ],
              message:
                "Mount runtime ownership only at the app boundary. Child components should consume session hooks instead of importing runtime owners directly.",
            },
          ],
        },
      ],
    },
  },
]);
