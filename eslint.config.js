import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['src/**/*.{js,jsx}', 'vite.config.js'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    files: ['functions/shared/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: { sourceType: 'module' },
  },
  {
    files: ['scripts/**/*.cjs', 'functions/**/*.cjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: {
        ...globals.node,
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly'
      },
      sourceType: 'commonjs',
    },
  },
])
