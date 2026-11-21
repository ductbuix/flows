import { existsSync, realpathSync } from "node:fs"
import { homedir } from "node:os"
import { resolve } from "node:path"

/**
 * Resolve a path; returns null when it does not exist or cannot be
 * realpath'd (symlink escape detection needs a realpath).
 */
export function tryRealpath(path: string): string | null {
  try {
    if (!existsSync(path)) return null
    return realpathSync(path)
  } catch {
    return null
  }
}

/** True when candidate realpath is under (or equal to) root realpath. */
export function isInsideRealpath(root: string, candidate: string): boolean {
  const r = resolve(root)
  const c = resolve(candidate)
  return c === r || c.startsWith(r + "/")
}

/**
 * Warn when a path escapes FLOWAPP_HOME, is missing, is `/`, or is the
 * user's home (DES-019). Never blocks.
 */
export function checkPathInsideHome(options: {
  id: string
  label: string
  path: string
  homeRealpath: string
}): { id: string; status: "pass" | "warn"; message: string } {
  const { id, label, path, homeRealpath } = options
  const resolved = tryRealpath(path)
  if (!resolved) {
    return {
      id,
      status: "warn",
      message: `${label} path missing or unreadable: ${path}`,
    }
  }
  if (resolved === "/" || resolved === realpathSync(homedir())) {
    return {
      id,
      status: "warn",
      message: `${label} resolves to a forbidden root (${resolved})`,
    }
  }
  if (!isInsideRealpath(homeRealpath, resolved)) {
    return {
      id,
      status: "warn",
      message: `${label} realpath is outside FLOWAPP_HOME (${resolved})`,
    }
  }
  return {
    id,
    status: "pass",
    message: `${label} is inside FLOWAPP_HOME`,
  }
}
