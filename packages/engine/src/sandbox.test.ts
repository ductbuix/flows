import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  buildSandboxSpawn,
  canApplySandbox,
  sandboxWriteRoot,
} from "./sandbox.ts"

const homes: string[] = []

afterEach(() => {
  delete process.env.FLOWAPP_SANDBOX
  for (const home of homes.splice(0)) {
    rmSync(home, { recursive: true, force: true })
  }
})

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-sandbox-"))
  homes.push(home)
  return home
}

describe("sandbox helpers", () => {
  it("respects FLOWAPP_SANDBOX=0 fallback", () => {
    process.env.FLOWAPP_SANDBOX = "0"
    expect(canApplySandbox()).toBe(false)
    const spawn = buildSandboxSpawn("echo hi", tempHome())
    expect(spawn.sandboxed).toBe(false)
    expect(spawn.command).toBe("/bin/sh")
  })

  it("wraps with sandbox-exec on macOS when enabled", () => {
    if (process.platform !== "darwin") return
    const home = tempHome()
    const spawn = buildSandboxSpawn("echo hi", home)
    expect(spawn.sandboxed).toBe(true)
    if (spawn.sandboxed) {
      expect(spawn.command).toBe("/usr/bin/sandbox-exec")
      expect(spawn.args).toContain(`WF_DIR=${sandboxWriteRoot(home)}`)
    }
  })
})
