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
import { uiGuardPlugin } from "./eslint-ui-guards.js"
import {
  noCycleBlock,
  webRestrictedImports,
} from "../../eslint-dependency-guards.mjs"

export default defineConfig([
  globalIgnores(["dist"]),
  noCycleBlock,
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
      ...webRestrictedImports,
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
  // DES-030: dense sizes, dialog widths, mono, frame padding.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    plugins: { "ui-guard": uiGuardPlugin },
    rules: {
      "ui-guard/dense-size": "error",
      "ui-guard/dialog-width": "error",
      "ui-guard/mono": "error",
      "ui-guard/frame-padding": "error",
    },
  },
  {
    files: ["src/pages/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    plugins: { "ui-guard": uiGuardPlugin },
    rules: {
      "ui-guard/page-frame-tags": "error",
      "ui-guard/no-time-format": "error",
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
