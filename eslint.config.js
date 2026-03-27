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
    files: [
      "packages/server/**/*.{ts,tsx}",
      "packages/create-airjam/**/*.{ts,tsx}",
    ],
    ignores: ["**/dist/**"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
    extends: [js.configs.recommended, tseslint.configs.recommended],
    rules: {
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
    },
  },
  {
    files: ["apps/**/*.{ts,tsx}", "packages/sdk/**/*.{ts,tsx}"],
    ignores: ["**/dist/**"],
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
    },
  },
  {
    files: ["apps/**/*.{ts,tsx}"],
    ignores: [
      "**/dist/**",
      "**/src/routes/host-view.tsx",
      "**/src/routes/controller-view.tsx",
      "**/src/game/host/index.tsx",
      "**/src/game/controller/index.tsx",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@air-jam/sdk",
              importNames: ["useAirJamHost", "useAirJamController"],
              message:
                "Mount runtime owner hooks only in the host/controller entry files. Child components should use useHostSession() or useControllerSession() instead.",
            },
          ],
        },
      ],
    },
  },
  // Disable ESLint rules that conflict with Prettier
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    rules: {
      ...prettierConfig.rules,
    },
  },
]);
