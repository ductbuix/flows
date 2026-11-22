/** True if the process exists (signal 0). */
export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** End a detached task's process group (negative pid). */
export function killProcessGroup(
  pid: number,
  signal: NodeJS.Signals = "SIGTERM"
): void {
  try {
    process.kill(-pid, signal)
  } catch {
    try {
      process.kill(pid, signal)
    } catch {
      // already gone
    }
  }
}

/** Poll until pid is gone, then resolve. */
export function waitForPid(pid: number, intervalMs = 50): Promise<void> {
  return new Promise((resolve) => {
    const tick = () => {
      if (!isPidAlive(pid)) {
        resolve()
        return
      }
      setTimeout(tick, intervalMs)
    }
    tick()
  })
}
