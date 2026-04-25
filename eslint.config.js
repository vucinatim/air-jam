import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

const tsconfigRootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig([
  globalIgnores([
    "dist",
    "**/dist/**",
    "node_modules",
    ".next",
    ".next/**",
    "**/.next/**",
    ".next-smoke",
    ".next-smoke/**",
    "**/.next-smoke/**",
    "out",
    "out/**",
    "**/out/**",
    "build",
    "build/**",
    "**/build/**",
    "apps/platform/**",
    "packages/create-airjam/scaffold-sources/**",
    "**/*.json",
    "**/*.css",
  ]),
  {
    files: [
      "packages/devtools-core/**/*.{ts,tsx}",
      "packages/env/**/*.{ts,tsx}",
      "packages/harness/**/*.{ts,tsx}",
      "packages/mcp-server/**/*.{ts,tsx}",
      "packages/runtime-topology/**/*.{ts,tsx}",
      "packages/server/**/*.{ts,tsx}",
      "packages/create-airjam/**/*.{ts,tsx}",
      "packages/*/tests/**/*.{ts,tsx}",
      "scripts/**/*.{ts,tsx}",
      "games/*/visual/**/*.{ts,tsx}",
    ],
    ignores: ["**/dist/**"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
      parserOptions: {
        tsconfigRootDir,
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
    files: [
      "apps/**/*.{ts,tsx}",
      "games/**/*.{ts,tsx}",
      "packages/sdk/**/*.{ts,tsx}",
    ],
    ignores: ["**/dist/**"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.browser,
      parserOptions: {
        tsconfigRootDir,
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
    files: ["packages/sdk/**/*.{ts,tsx}"],
    rules: {
      "react-refresh/only-export-components": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["tests/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
      parserOptions: {
        tsconfigRootDir,
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
  // Disable ESLint rules that conflict with Prettier
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    rules: {
      ...prettierConfig.rules,
    },
  },
]);
