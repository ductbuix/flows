import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"
import { z } from "zod"

const LOCK_NAME = "engine.lock"

const engineLockSchema = z.object({
  pid: z.number().int().positive(),
  url: z.string().min(1),
  token: z.string().min(1),
})

export type EngineLockSelf = {
  url: string
  token: string
}

export type AcquireLockResult =
  { owned: true } | { attachTo: { url: string; token: string; pid: number } }

export type PeekLockResult = { url: string; token: string; pid: number }

function lockPath(home: string): string {
  return join(home, LOCK_NAME)
}

/** True when the process is still running (signal 0). */
function isPidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    // EPERM: process exists; we just cannot signal it.
    return code === "EPERM"
  }
}

function readLock(path: string): z.infer<typeof engineLockSchema> | null {
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as unknown
    const parsed = engineLockSchema.safeParse(raw)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

function writeExclusive(
  path: string,
  self: EngineLockSelf,
  pid: number
): boolean {
  const body = JSON.stringify({ pid, url: self.url, token: self.token })
  try {
    const fd = openSync(
      path,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL,
      0o600
    )
    try {
      writeFileSync(fd, body, "utf8")
    } finally {
      closeSync(fd)
    }
    chmodSync(path, 0o600)
    return true
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") return false
    throw err
  }
}

function removeStale(path: string): void {
  try {
    unlinkSync(path)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
  }
}

/**
 * Read a live owner from `$FLOWAPP_HOME/engine.lock`, or null if none/stale.
 * Does not take or replace the lock (clients attach; hosts use acquireLock).
 */
export function peekLock(home: string): PeekLockResult | null {
  const path = lockPath(home)
  if (!existsSync(path)) return null
  const existing = readLock(path)
  if (!existing || !isPidAlive(existing.pid)) return null
  return { url: existing.url, token: existing.token, pid: existing.pid }
}

/**
 * Live owner url+token without pid (desktop/CLI attach probe; DES-039).
 * Thin wrapper over peekLock — same staleness rules, no second read path.
 */
export function liveOwner(home: string): { url: string; token: string } | null {
  const owner = peekLock(home)
  if (!owner) return null
  return { url: owner.url, token: owner.token }
}

/**
 * Take `$FLOWAPP_HOME/engine.lock` (O_EXCL, mode 0600) or report a live owner.
 * A lock whose pid is gone is replaced (DES-039).
 */
export function acquireLock(
  home: string,
  self: EngineLockSelf
): AcquireLockResult {
  mkdirSync(home, { recursive: true })
  const path = lockPath(home)
  const pid = process.pid

  for (let attempt = 0; attempt < 8; attempt++) {
    if (writeExclusive(path, self, pid)) {
      return { owned: true }
    }

    const existing = readLock(path)
    if (existing && isPidAlive(existing.pid)) {
      return {
        attachTo: {
          url: existing.url,
          token: existing.token,
          pid: existing.pid,
        },
      }
    }

    // Stale or corrupt: remove and retry with O_EXCL.
    removeStale(path)
  }

  throw new Error(`could not acquire engine.lock under ${home}`)
}

/** Remove the lock on clean shutdown when this process still owns it. */
export function releaseLock(home: string): void {
  const path = lockPath(home)
  if (!existsSync(path)) return
  const existing = readLock(path)
  if (existing && existing.pid !== process.pid) return
  removeStale(path)
}
