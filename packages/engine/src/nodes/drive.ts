import type { StepsState } from "./fold-steps.ts"
import type { ProcessHost } from "./process.ts"
import {
  startNodeRun,
  tickNodes,
  type NodeRunOptions,
  type StartNodeRunOptions,
} from "./tick.ts"

/**
 * Drives a node run until it ends. Process steps finish on their own
 * clock, so each finished attempt (or retry backoff) wakes the tick.
 */
function drive(
  first: (process: ProcessHost) => StepsState,
  again: (process: ProcessHost) => StepsState
): Promise<StepsState> {
  return new Promise((resolve, reject) => {
    const timers = new Set<ReturnType<typeof setTimeout>>()
    let done = false
    const finish = (fn: () => void) => {
      if (done) return
      done = true
      for (const t of timers) clearTimeout(t)
      fn()
    }
    const pump = (step: (process: ProcessHost) => StepsState) => {
      if (done) return
      try {
        const state = step(host)
        if (state.ended) finish(() => resolve(state))
      } catch (error) {
        finish(() => reject(error))
      }
    }
    const later = (ms: number) => {
      const t = setTimeout(() => {
        timers.delete(t)
        pump(again)
      }, ms)
      timers.add(t)
    }
    const host: ProcessHost = {
      watching: new Set(),
      wake: () => later(0),
      later,
    }
    pump(first)
  })
}

/** Starts a node run and resolves when it ends (DES-034). */
export function runNodes(opts: StartNodeRunOptions): Promise<StepsState> {
  return drive(
    (process) => startNodeRun({ ...opts, process }),
    (process) => tickNodes({ ...opts, process })
  )
}

/** Resumes a node run after a restart: re-attaches, then drives it. */
export function resumeNodes(opts: NodeRunOptions): Promise<StepsState> {
  const run = (process: ProcessHost) => tickNodes({ ...opts, process })
  return drive(run, run)
}
