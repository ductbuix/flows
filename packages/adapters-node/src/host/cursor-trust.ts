import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

export type CursorTrustMarker = {
  trustedAt: string
  workspacePath: string
}

/**
 * Cursor project slug: strip leading slashes, replace `/` with `-`.
 * Matches ~/.cursor/projects/<slug>/.workspace-trusted (DES-019).
 */
export function sanitizeCursorProjectPath(workspacePath: string): string {
  return workspacePath.replace(/^\/+/, "").replaceAll("/", "-")
}

/** Default Cursor projects root; override with FLOWAPP_CURSOR_PROJECTS. */
export function resolveCursorProjectsDir(override?: string): string {
  if (override) return override
  if (process.env.FLOWAPP_CURSOR_PROJECTS) {
    return process.env.FLOWAPP_CURSOR_PROJECTS
  }
  return join(homedir(), ".cursor", "projects")
}

/**
 * Paths Cursor may use for the same directory. On macOS `/var` is a
 * symlink to `/private/var`; Cursor often keeps the `/var` form, so a
 * realpath-only marker does not match (BL-018 live check).
 */
export function cursorPathVariants(workspacePath: string): string[] {
  const out = new Set<string>()
  out.add(workspacePath)
  try {
    if (existsSync(workspacePath)) {
      const resolved = realpathSync(workspacePath)
      out.add(resolved)
      if (resolved.startsWith("/private/")) {
        out.add(resolved.slice("/private".length))
      }
    }
  } catch {
    /* keep input */
  }
  if (workspacePath.startsWith("/var/")) {
    out.add(`/private${workspacePath}`)
  }
  return [...out]
}

export function cursorTrustMarkerPath(
  workspacePath: string,
  projectsDir?: string
): string {
  const slug = sanitizeCursorProjectPath(workspacePath)
  return join(resolveCursorProjectsDir(projectsDir), slug, ".workspace-trusted")
}

/** Write Cursor trust markers for every path variant. */
export function writeCursorTrustMarker(
  workspacePath: string,
  projectsDir?: string
): string[] {
  const written: string[] = []
  const trustedAt = new Date().toISOString()
  for (const path of cursorPathVariants(workspacePath)) {
    const markerPath = cursorTrustMarkerPath(path, projectsDir)
    mkdirSync(join(markerPath, ".."), { recursive: true })
    const body: CursorTrustMarker = {
      trustedAt,
      workspacePath: path,
    }
    writeFileSync(markerPath, `${JSON.stringify(body, null, 2)}\n`, "utf8")
    written.push(markerPath)
  }
  return written
}

/** Remove markers for every path variant. */
export function removeCursorTrustMarker(
  workspacePath: string,
  projectsDir?: string
): boolean {
  let removed = false
  for (const path of cursorPathVariants(workspacePath)) {
    const markerPath = cursorTrustMarkerPath(path, projectsDir)
    if (!existsSync(markerPath)) continue
    rmSync(markerPath, { force: true })
    removed = true
  }
  return removed
}

export function readCursorTrustMarker(
  workspacePath: string,
  projectsDir?: string
): CursorTrustMarker | null {
  for (const path of cursorPathVariants(workspacePath)) {
    const markerPath = cursorTrustMarkerPath(path, projectsDir)
    if (!existsSync(markerPath)) continue
    try {
      const raw = JSON.parse(readFileSync(markerPath, "utf8")) as Record<
        string,
        unknown
      >
      if (
        typeof raw.trustedAt !== "string" ||
        typeof raw.workspacePath !== "string"
      ) {
        continue
      }
      return {
        trustedAt: raw.trustedAt,
        workspacePath: raw.workspacePath,
      }
    } catch {
      continue
    }
  }
  return null
}

/**
 * Path depth in components (leading empty from absolute path ignored).
 * Cursor inherits trust from parents except home and paths shallower
 * than three components (DES-019).
 */
export function pathComponentCount(absPath: string): number {
  return absPath.split("/").filter(Boolean).length
}
