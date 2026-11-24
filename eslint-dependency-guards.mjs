/**
 * DES-042 / DES-039 package dependency lint guards.
 * Shared by every package eslint.config.js so layering cannot drift.
 */
import { importX } from "eslint-plugin-import-x"

/** `import/no-cycle` via eslint-plugin-import-x (ESLint 10). */
export const noCycleBlock = {
  files: ["**/*.{ts,tsx}"],
  plugins: {
    // Register under `import` so the rule id matches DES-042 (`import/no-cycle`).
    import: importX,
  },
  settings: {
    "import-x/parsers": {
      "@typescript-eslint/parser": [".ts", ".tsx"],
    },
    "import-x/resolver": {
      node: { extensions: [".js", ".jsx", ".ts", ".tsx"] },
    },
  },
  rules: {
    "import/no-cycle": ["error", { maxDepth: Infinity }],
  },
}

/** contracts: imports nothing else in the repo. */
export const contractsRestrictedImports = {
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        {
          group: ["@workspace/*"],
          message: "contracts must not import other workspace packages",
        },
      ],
    },
  ],
}

/** core: no Node I/O modules (DES-039 / BL-113). */
export const coreRestrictedImports = {
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
}

/** adapters: never import another adapter package. */
export const adaptersRestrictedImports = {
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        {
          group: [
            "@workspace/adapters-*",
            "@workspace/agent-acp",
            "@workspace/agent-acp/*",
            "@workspace/mcp-gateway",
            "@workspace/mcp-gateway/*",
          ],
          message: "adapters must not import other adapters",
        },
      ],
    },
  ],
}

/** web: never import core, engine or adapters. */
export const webRestrictedImports = {
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        {
          group: [
            "@workspace/core",
            "@workspace/core/*",
            "@workspace/engine",
            "@workspace/engine/*",
            "@workspace/adapters-*",
          ],
          message: "web must not import core, engine or adapters",
        },
      ],
    },
  ],
}
