import js from "@eslint/js"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"
import { restrictedSyntaxSelectors } from "./eslint-tailwind-guard.js"

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  // DES-024: ban arbitrary values and palette colors in apps/web class strings.
  // Allowed: data-/aria-/has-/group- variants (enforced via unit-tested helper;
  // selectors catch the common banned forms). packages/ui is not covered.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", ...restrictedSyntaxSelectors()],
    },
  },
  // Soft limit per code file (clean-code.mdc): split by responsibility.
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "max-lines": [
        "warn",
        { max: 200, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  {
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    rules: {
      "max-lines": [
        "warn",
        { max: 300, skipBlankLines: true, skipComments: true },
      ],
    },
  },
])
