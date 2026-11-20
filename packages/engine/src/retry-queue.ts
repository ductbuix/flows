/**
 * Tracks backoff timers for retry launches so the scheduler can settle
 * only when no retries are pending.
 */
export class RetryQueue {
  private readonly pending = new Set<string>()
  private readonly timers = new Set<ReturnType<typeof setTimeout>>()

  get size(): number {
    return this.pending.size
  }

  clear(): void {
    for (const timer of this.timers) clearTimeout(timer)
    this.timers.clear()
    this.pending.clear()
  }

  /**
   * Schedule `launch` after backoff. No-ops if this taskId is already
   * waiting. Returns true if a new timer was armed.
   */
  schedule(taskId: string, backoffMs: number, launch: () => void): boolean {
    if (this.pending.has(taskId)) return false
    this.pending.add(taskId)
    const timer = setTimeout(() => {
      this.timers.delete(timer)
      this.pending.delete(taskId)
      launch()
    }, backoffMs)
    this.timers.add(timer)
    return true
  }
}
