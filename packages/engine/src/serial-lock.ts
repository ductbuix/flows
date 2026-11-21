/**
 * Cross-run serial lock for connections with `serial: true` (DES-026 /
 * BL-048). Propose tasks on one connection run one at a time.
 */

export type SerialHolder = {
  connectionId: string
  runId: string
  taskId: string
  attempt: number
}

type Waiter = {
  runId: string
  taskId: string
  onReady: () => void
}

export class SerialLockManager {
  private readonly holders = new Map<string, SerialHolder>()
  private readonly waiters = new Map<string, Waiter[]>()
  /** Ready tasks blocked on a lock, for UI "why" (BL-048). */
  private readonly waitingReasons = new Map<string, string>()

  private key(runId: string, taskId: string): string {
    return `${runId}:${taskId}`
  }

  /** Current holder of a connection lock, if any. */
  holder(connectionId: string): SerialHolder | undefined {
    return this.holders.get(connectionId)
  }

  /**
   * Try to take the lock for every connection. On failure none are held
   * and `waitingReason` is set for the task.
   */
  tryAcquire(
    connectionIds: string[],
    holder: Omit<SerialHolder, "connectionId">
  ): { ok: true } | { ok: false; connectionId: string; reason: string } {
    const unique = [...new Set(connectionIds)]
    for (const connectionId of unique) {
      const current = this.holders.get(connectionId)
      if (
        current &&
        !(
          current.runId === holder.runId &&
          current.taskId === holder.taskId &&
          current.attempt === holder.attempt
        )
      ) {
        const reason = `Waiting for serial connection ${connectionId} (held by run ${current.runId} task ${current.taskId})`
        this.waitingReasons.set(this.key(holder.runId, holder.taskId), reason)
        return { ok: false, connectionId, reason }
      }
    }
    for (const connectionId of unique) {
      this.holders.set(connectionId, { ...holder, connectionId })
    }
    this.waitingReasons.delete(this.key(holder.runId, holder.taskId))
    return { ok: true }
  }

  /** Register a callback when a connection's lock may be free again. */
  waitFor(connectionId: string, waiter: Waiter): void {
    const list = this.waiters.get(connectionId) ?? []
    if (
      list.some((w) => w.runId === waiter.runId && w.taskId === waiter.taskId)
    ) {
      return
    }
    list.push(waiter)
    this.waiters.set(connectionId, list)
  }

  /** Release every connection held by this attempt; wake waiters. */
  release(runId: string, taskId: string, attempt: number): void {
    const freed: string[] = []
    for (const [connectionId, held] of this.holders) {
      if (
        held.runId === runId &&
        held.taskId === taskId &&
        held.attempt === attempt
      ) {
        this.holders.delete(connectionId)
        freed.push(connectionId)
      }
    }
    this.waitingReasons.delete(this.key(runId, taskId))
    for (const connectionId of freed) {
      const list = this.waiters.get(connectionId) ?? []
      this.waiters.delete(connectionId)
      for (const waiter of list) waiter.onReady()
    }
  }

  /** Why a pending task is blocked on a serial lock, if any. */
  waitingReason(runId: string, taskId: string): string | undefined {
    return this.waitingReasons.get(this.key(runId, taskId))
  }

  /** Clear a stale waiting reason when the task is no longer ready. */
  clearWaiting(runId: string, taskId: string): void {
    this.waitingReasons.delete(this.key(runId, taskId))
  }

  /** Test helper. */
  reset(): void {
    this.holders.clear()
    this.waiters.clear()
    this.waitingReasons.clear()
  }
}

export const serialLocks = new SerialLockManager()
