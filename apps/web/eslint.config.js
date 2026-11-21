import js from "@eslint/js"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"
import {
  noUiSizeRadiusClassRule,
  restrictedSyntaxSelectors,
} from "./eslint-tailwind-guard.js"

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
  // DES-024 / DES-025: ban arbitrary values, palette colors, and size/radius
  // className on @workspace/ui parts. packages/ui is not covered.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    plugins: {
      "tailwind-guard": {
        rules: {
          "no-ui-size-radius-class": noUiSizeRadiusClassRule,
        },
      },
    },
    rules: {
      "no-restricted-syntax": ["error", ...restrictedSyntaxSelectors()],
      "tailwind-guard/no-ui-size-radius-class": "error",
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
