import js from "@eslint/js"
import globals from "globals"
import tseslint from "typescript-eslint"
import { defineConfig } from "eslint/config"
import { noCycleBlock } from "../../eslint-dependency-guards.mjs"

export default defineConfig([
  noCycleBlock,
  {
    files: ["**/*.{ts,tsx,mjs}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },
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
    files: ["**/*.test.{ts,tsx}"],
    rules: {
      "max-lines": [
        "warn",
        { max: 300, skipBlankLines: true, skipComments: true },
      ],
    },
  },
])
