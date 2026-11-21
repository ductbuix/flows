import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  cursorTrustMarkerPath,
  pathComponentCount,
  readCursorTrustMarker,
  removeCursorTrustMarker,
  sanitizeCursorProjectPath,
  writeCursorTrustMarker,
} from "./cursor-trust.ts"

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe("cursor trust marker", () => {
  it("sanitizes absolute paths like Cursor projects", () => {
    expect(
      sanitizeCursorProjectPath("/Users/dbx/Workspaces/costory/flows")
    ).toBe("Users-dbx-Workspaces-costory-flows")
  })

  it("writes and removes a marker under an isolated projects dir", () => {
    const root = mkdtempSync(join(tmpdir(), "cursor-projects-"))
    dirs.push(root)
    const workspace = mkdtempSync(join(tmpdir(), "ws-"))
    dirs.push(workspace)

    const markerPaths = writeCursorTrustMarker(workspace, root)
    expect(markerPaths.length).toBeGreaterThan(0)
    expect(existsSync(markerPaths[0]!)).toBe(true)
    expect(markerPaths).toContain(
      cursorTrustMarkerPath(realpathSync(workspace), root)
    )

    const marker = readCursorTrustMarker(workspace, root)
    expect(marker?.workspacePath).toBeTruthy()
    const raw = JSON.parse(readFileSync(markerPaths[0]!, "utf8")) as {
      trustedAt: string
      workspacePath: string
    }
    expect(raw.trustedAt).toMatch(/^\d{4}-/)
    expect(raw.workspacePath).toBeTruthy()
    expect(marker?.workspacePath).toBeTruthy()

    expect(removeCursorTrustMarker(workspace, root)).toBe(true)
    expect(existsSync(markerPaths[0]!)).toBe(false)
  })

  it("counts path components for the inheritance rule", () => {
    expect(pathComponentCount("/Users/dbx/.flowapp")).toBe(3)
    expect(pathComponentCount("/tmp/x")).toBe(2)
    mkdirSync(join(tmpdir(), "noop"), { recursive: true })
  })
})
