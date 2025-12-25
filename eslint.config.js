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
    files: ["packages/server/**/*.{ts,tsx}", "packages/create-airjam/**/*.{ts,tsx}"],
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
