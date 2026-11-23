import js from "@eslint/js"
import globals from "globals"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "fs", message: "core must not import Node fs" },
            { name: "node:fs", message: "core must not import node:fs" },
            {
              name: "child_process",
              message: "core must not import child_process",
            },
            {
              name: "node:child_process",
              message: "core must not import node:child_process",
            },
            {
              name: "better-sqlite3",
              message: "core must not import better-sqlite3",
            },
          ],
          patterns: [
            {
              group: ["node:*"],
              message: "core must not import node:* modules",
            },
          ],
        },
      ],
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
