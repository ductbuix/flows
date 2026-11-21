import { mkdirSync } from "node:fs"
import { join } from "node:path"

/** Package-manager cache dirs under `<workflow>/.cache/` (DES-026). */
export function workflowCacheEnv(workflowRoot: string): Record<string, string> {
  const root = join(workflowRoot, ".cache")
  mkdirSync(join(root, "npm"), { recursive: true })
  mkdirSync(join(root, "pnpm"), { recursive: true })
  mkdirSync(join(root, "yarn"), { recursive: true })
  mkdirSync(join(root, "pip"), { recursive: true })
  mkdirSync(join(root, "xdg-config"), { recursive: true })
  mkdirSync(join(root, "xdg-data"), { recursive: true })
  mkdirSync(join(root, "xdg-state"), { recursive: true })
  mkdirSync(join(root, "xdg-runtime"), { recursive: true })
  // Keep package managers from writing preference files under ~/Library
  // or ~/.config, and pnpm store locks under /tmp, which the sandbox
  // denies (DES-006 / DES-026; pnpm uses XDG_RUNTIME_DIR for locks).
  return {
    npm_config_cache: join(root, "npm"),
    PNPM_STORE_DIR: join(root, "pnpm"),
    YARN_CACHE_FOLDER: join(root, "yarn"),
    XDG_CACHE_HOME: root,
    XDG_CONFIG_HOME: join(root, "xdg-config"),
    XDG_DATA_HOME: join(root, "xdg-data"),
    XDG_STATE_HOME: join(root, "xdg-state"),
    XDG_RUNTIME_DIR: join(root, "xdg-runtime"),
    PIP_CACHE_DIR: join(root, "pip"),
  }
}

/** Relative path templates shown in the Environment tab. */
export const WORKFLOW_CACHE_ENV_TEMPLATES: ReadonlyArray<{
  name: string
  value: string
}> = [
  { name: "npm_config_cache", value: ".cache/npm" },
  { name: "PNPM_STORE_DIR", value: ".cache/pnpm" },
  { name: "YARN_CACHE_FOLDER", value: ".cache/yarn" },
  { name: "XDG_CACHE_HOME", value: ".cache" },
  { name: "PIP_CACHE_DIR", value: ".cache/pip" },
]
