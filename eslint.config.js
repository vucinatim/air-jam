import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'node_modules']),
  {
    files: ['packages/server/**/*.{ts,tsx}'],
    ignores: ['**/dist/**'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
    extends: [js.configs.recommended, tseslint.configs.recommended],
  },
  {
    files: ['apps/**/*.{ts,tsx}', 'packages/sdk/**/*.{ts,tsx}'],
    ignores: ['**/dist/**'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.browser,
    },
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
  },
])
