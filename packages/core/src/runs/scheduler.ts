export type SchedulerGrant = {
  runId: string
  stepId: string
}

export type SchedulerLimits = {
  /** Global step launch cap (`agents.maxConcurrent`, DES-041). */
  maxConcurrent: number
}

/**
 * Pure policy: which actors may launch steps under a global limit.
 * Fed by actor requests; no I/O (DES-041, DES-021).
 */
export type Scheduler = {
  request(runId: string, stepId: string): void
  release(runId: string, stepId: string): void
  /** Drop every grant and pending request for a run (cancel). */
  cancel(runId: string): void
  grants(): readonly SchedulerGrant[]
}

function keyOf(runId: string, stepId: string): string {
  return `${runId}\0${stepId}`
}

export function createScheduler(limits: SchedulerLimits): Scheduler {
  if (!Number.isInteger(limits.maxConcurrent) || limits.maxConcurrent < 1) {
    throw new Error("maxConcurrent must be a positive integer")
  }

  const granted = new Map<string, SchedulerGrant>()
  const pending: SchedulerGrant[] = []

  function fill(): void {
    while (granted.size < limits.maxConcurrent && pending.length > 0) {
      const next = pending.shift()!
      const k = keyOf(next.runId, next.stepId)
      if (granted.has(k)) continue
      granted.set(k, next)
    }
  }

  return {
    request(runId: string, stepId: string): void {
      const k = keyOf(runId, stepId)
      if (granted.has(k)) return
      if (pending.some((p) => p.runId === runId && p.stepId === stepId)) {
        return
      }
      if (granted.size < limits.maxConcurrent) {
        granted.set(k, { runId, stepId })
        return
      }
      pending.push({ runId, stepId })
    },

    release(runId: string, stepId: string): void {
      const k = keyOf(runId, stepId)
      granted.delete(k)
      const idx = pending.findIndex(
        (p) => p.runId === runId && p.stepId === stepId
      )
      if (idx >= 0) pending.splice(idx, 1)
      fill()
    },

    cancel(runId: string): void {
      for (const k of [...granted.keys()]) {
        if (granted.get(k)?.runId === runId) granted.delete(k)
      }
      for (let i = pending.length - 1; i >= 0; i--) {
        if (pending[i]!.runId === runId) pending.splice(i, 1)
      }
      fill()
    },

    grants(): readonly SchedulerGrant[] {
      return [...granted.values()]
    },
  }
}
