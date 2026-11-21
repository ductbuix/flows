import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { checkPathInsideHome, isInsideRealpath } from "./path-checks.ts"
import { resolveAppHomeRealpath } from "./paths.ts"

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe("path checks", () => {
  it("passes when the path is inside FLOWAPP_HOME", () => {
    const home = mkdtempSync(join(tmpdir(), "flowapp-pc-"))
    dirs.push(home)
    const homeReal = resolveAppHomeRealpath(home)
    const inner = join(home, "workflows", "x")
    mkdirSync(inner, { recursive: true })
    const check = checkPathInsideHome({
      id: "workflow_dir",
      label: "Workflow dir",
      path: inner,
      homeRealpath: homeReal,
    })
    expect(check.status).toBe("pass")
  })

  it("warns when realpath escapes FLOWAPP_HOME via symlink", () => {
    const home = mkdtempSync(join(tmpdir(), "flowapp-pc-"))
    const outside = mkdtempSync(join(tmpdir(), "outside-"))
    dirs.push(home, outside)
    const homeReal = resolveAppHomeRealpath(home)
    const link = join(home, "escape")
    symlinkSync(outside, link)
    const check = checkPathInsideHome({
      id: "workflow_dir",
      label: "Workflow dir",
      path: link,
      homeRealpath: homeReal,
    })
    expect(check.status).toBe("warn")
    expect(check.message).toMatch(/outside FLOWAPP_HOME/)
  })

  it("rejects containment for paths outside the root", () => {
    expect(isInsideRealpath("/a/b", "/a/c")).toBe(false)
    expect(isInsideRealpath("/a/b", "/a/b/c")).toBe(true)
  })

  it("warns for the user home directory", () => {
    const check = checkPathInsideHome({
      id: "workflow_dir",
      label: "Workflow dir",
      path: homedir(),
      homeRealpath: "/tmp/flowapp-home-not-user",
    })
    expect(check.status).toBe("warn")
  })
})
