import { acquireLock, releaseLock } from "@workspace/adapters-node"
import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { resolveEngineMode } from "./resolve-engine-mode.ts"

const temps: string[] = []

afterEach(() => {
  while (temps.length > 0) {
    rmSync(temps.pop()!, { recursive: true, force: true })
  }
})

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-mode-"))
  temps.push(home)
  return home
}

function deadPid(): number {
  const result = spawnSync(
    process.execPath,
    ["-e", "process.stdout.write(String(process.pid))"],
    { encoding: "utf8" }
  )
  expect(result.status).toBe(0)
  return Number(result.stdout)
}

describe("resolveEngineMode", () => {
  it("returns own when there is no lock", () => {
    expect(resolveEngineMode(tempHome())).toEqual({ kind: "own" })
  })

  it("returns own when the lock pid is stale", () => {
    const home = tempHome()
    writeFileSync(
      join(home, "engine.lock"),
      JSON.stringify({
        pid: deadPid(),
        url: "ws://127.0.0.1:1/fcp",
        token: "stale",
      }),
      { mode: 0o600 }
    )
    expect(resolveEngineMode(home)).toEqual({ kind: "own" })
  })

  it("returns attach when a live ws owner holds the lock", () => {
    const home = tempHome()
    const self = { url: "ws://127.0.0.1:8787/fcp", token: "live-token" }
    expect(acquireLock(home, self)).toEqual({ owned: true })
    expect(resolveEngineMode(home)).toEqual({
      kind: "attach",
      url: self.url,
      token: self.token,
    })
    releaseLock(home)
  })

  it("returns busy when a live non-ws owner holds the lock", () => {
    const home = tempHome()
    const self = {
      url: "flows-desktop://utility-process",
      token: "inproc-token",
    }
    expect(acquireLock(home, self)).toEqual({ owned: true })
    expect(resolveEngineMode(home)).toEqual({
      kind: "busy",
      pid: process.pid,
    })
    releaseLock(home)
  })
})
