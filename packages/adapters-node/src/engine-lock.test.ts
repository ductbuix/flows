import { spawnSync } from "node:child_process"
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { acquireLock, releaseLock } from "./engine-lock.ts"

const temps: string[] = []

afterEach(() => {
  while (temps.length > 0) {
    rmSync(temps.pop()!, { recursive: true, force: true })
  }
})

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "flowapp-lock-"))
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
  const pid = Number(result.stdout)
  expect(pid).toBeGreaterThan(0)
  return pid
}

const selfA = { url: "ws://127.0.0.1:8787/fcp", token: "token-a" }
const selfB = { url: "ws://127.0.0.1:8788/fcp", token: "token-b" }

describe("acquireLock", () => {
  it("creates engine.lock with O_EXCL semantics, mode 0600, and returns owned", () => {
    const home = tempHome()
    const result = acquireLock(home, selfA)
    expect(result).toEqual({ owned: true })

    const path = join(home, "engine.lock")
    expect(existsSync(path)).toBe(true)
    expect(statSync(path).mode & 0o777).toBe(0o600)

    const body = JSON.parse(readFileSync(path, "utf8")) as {
      pid: number
      url: string
      token: string
    }
    expect(body.pid).toBe(process.pid)
    expect(body.url).toBe(selfA.url)
    expect(body.token).toBe(selfA.token)
  })

  it("returns attachTo when a live owner holds the lock", () => {
    const home = tempHome()
    expect(acquireLock(home, selfA)).toEqual({ owned: true })

    const second = acquireLock(home, selfB)
    expect(second).toEqual({
      attachTo: { url: selfA.url, token: selfA.token },
    })
    expect(
      JSON.parse(readFileSync(join(home, "engine.lock"), "utf8"))
    ).toMatchObject({ pid: process.pid, token: selfA.token })
  })

  it("replaces a lock whose pid is gone", () => {
    const home = tempHome()
    const path = join(home, "engine.lock")
    writeFileSync(
      path,
      JSON.stringify({
        pid: deadPid(),
        url: "ws://127.0.0.1:1/fcp",
        token: "stale-token",
      }),
      { mode: 0o600 }
    )

    const result = acquireLock(home, selfB)
    expect(result).toEqual({ owned: true })
    const body = JSON.parse(readFileSync(path, "utf8")) as {
      pid: number
      token: string
    }
    expect(body.pid).toBe(process.pid)
    expect(body.token).toBe(selfB.token)
  })

  it("replaces a corrupt lock file", () => {
    const home = tempHome()
    writeFileSync(join(home, "engine.lock"), "not-json", { mode: 0o600 })
    expect(acquireLock(home, selfA)).toEqual({ owned: true })
  })
})

describe("releaseLock", () => {
  it("removes the lock on clean shutdown when this process owns it", () => {
    const home = tempHome()
    expect(acquireLock(home, selfA)).toEqual({ owned: true })
    releaseLock(home)
    expect(existsSync(join(home, "engine.lock"))).toBe(false)

    // A later host can take ownership again.
    expect(acquireLock(home, selfB)).toEqual({ owned: true })
  })

  it("does not remove a lock owned by another pid", () => {
    const home = tempHome()
    const path = join(home, "engine.lock")
    writeFileSync(
      path,
      JSON.stringify({
        pid: deadPid(),
        url: selfA.url,
        token: selfA.token,
      }),
      { mode: 0o600 }
    )
    releaseLock(home)
    expect(existsSync(path)).toBe(true)
  })
})
