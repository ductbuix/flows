export type SchedulerGrant = {
  runId: string
  stepId: string
}

export type SchedulerRun = {
  runId: string
  workflowId: string
  at: string
}

export type SchedulerLimits = {
  /** Global step launch cap (`agents.maxConcurrent`, DES-041). */
  maxConcurrent: number
  /**
   * Cap of `running` runs per workflow (DES-021). Default 1.
   * Pass a number for all workflows, or a per-workflow lookup.
   */
  maxConcurrentRuns?: number | ((workflowId: string) => number)
}

/**
 * Pure policy: step grants under a global limit, and per-workflow run
 * queues under maxConcurrentRuns (DES-041, DES-021). No I/O.
 */
export type Scheduler = {
  request(runId: string, stepId: string): void
  release(runId: string, stepId: string): void
  /**
   * Drop step grants/pending for a run. If the run is queued, remove it
   * from the queue (frees nothing). If running, end it and activate the
   * next queued run for that workflow by `at` FIFO.
   */
  cancel(runId: string): void
  grants(): readonly SchedulerGrant[]

  /** Admit a run: `running` under the workflow cap, else `queued` (DES-021). */
  admit(runId: string, workflowId: string, at: string): "running" | "queued"
  /**
   * Put a run in `running` even over the cap (manual retry parity with
   * the old engine, which did not re-check maxConcurrentRuns).
   */
  forceRunning(runId: string, workflowId: string, at: string): void
  /** Run left `running` (succeeded/failed); activates next queued by `at`. */
  endRun(runId: string): void
  activeRuns(): readonly SchedulerRun[]
  queuedRuns(): readonly SchedulerRun[]
}

function keyOf(runId: string, stepId: string): string {
  return `${runId}\0${stepId}`
}

function capFor(limits: SchedulerLimits, workflowId: string): number {
  const raw = limits.maxConcurrentRuns
  if (raw === undefined) return 1
  if (typeof raw === "function") return raw(workflowId)
  return raw
}

export function createScheduler(limits: SchedulerLimits): Scheduler {
  if (!Number.isInteger(limits.maxConcurrent) || limits.maxConcurrent < 1) {
    throw new Error("maxConcurrent must be a positive integer")
  }

  const granted = new Map<string, SchedulerGrant>()
  const pending: SchedulerGrant[] = []
  const active = new Map<string, SchedulerRun>()
  const queued: SchedulerRun[] = []

  function fillSteps(): void {
    while (granted.size < limits.maxConcurrent && pending.length > 0) {
      const next = pending.shift()!
      const k = keyOf(next.runId, next.stepId)
      if (granted.has(k)) continue
      granted.set(k, next)
    }
  }

  function runningCount(workflowId: string): number {
    let n = 0
    for (const r of active.values()) {
      if (r.workflowId === workflowId) n++
    }
    return n
  }

  /** Activate oldest queued runs (by `at`) while under each workflow cap. */
  function fillRuns(): void {
    queued.sort((a, b) =>
      a.at < b.at ? -1 : a.at > b.at ? 1 : a.runId.localeCompare(b.runId)
    )
    let i = 0
    while (i < queued.length) {
      const r = queued[i]!
      if (runningCount(r.workflowId) < capFor(limits, r.workflowId)) {
        queued.splice(i, 1)
        active.set(r.runId, r)
        continue
      }
      i++
    }
  }

  function clearSteps(runId: string): void {
    for (const k of [...granted.keys()]) {
      if (granted.get(k)?.runId === runId) granted.delete(k)
    }
    for (let i = pending.length - 1; i >= 0; i--) {
      if (pending[i]!.runId === runId) pending.splice(i, 1)
    }
  }

  function endActive(runId: string): boolean {
    if (!active.has(runId)) return false
    active.delete(runId)
    fillRuns()
    return true
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
      fillSteps()
    },

    cancel(runId: string): void {
      clearSteps(runId)
      fillSteps()
      const q = queued.findIndex((r) => r.runId === runId)
      if (q >= 0) {
        // Queued cancel frees nothing (DES-021).
        queued.splice(q, 1)
        return
      }
      endActive(runId)
    },

    grants(): readonly SchedulerGrant[] {
      return [...granted.values()]
    },

    admit(runId: string, workflowId: string, at: string): "running" | "queued" {
      if (active.has(runId)) return "running"
      if (queued.some((r) => r.runId === runId)) return "queued"
      const record: SchedulerRun = { runId, workflowId, at }
      if (runningCount(workflowId) < capFor(limits, workflowId)) {
        active.set(runId, record)
        return "running"
      }
      queued.push(record)
      return "queued"
    },

    forceRunning(runId: string, workflowId: string, at: string): void {
      const q = queued.findIndex((r) => r.runId === runId)
      if (q >= 0) queued.splice(q, 1)
      active.set(runId, { runId, workflowId, at })
    },

    endRun(runId: string): void {
      clearSteps(runId)
      fillSteps()
      endActive(runId)
    },

    activeRuns(): readonly SchedulerRun[] {
      return [...active.values()]
    },

    queuedRuns(): readonly SchedulerRun[] {
      return [...queued]
    },
  }
}
