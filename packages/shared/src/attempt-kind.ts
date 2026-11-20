import { z } from "zod"
import type { Task } from "./workflow.ts"

export const attemptKindSchema = z.enum([
  "run",
  "retry",
  "repeat",
  "manual_retry",
  "interrupted",
])

export type AttemptKind = z.infer<typeof attemptKindSchema>

export const attemptKindInfoSchema = z.object({
  kind: attemptKindSchema,
  label: z.string().min(1),
  /** Full sentence for aria-label, e.g. "Retry 2 of 3 after exit code 1". */
  ariaLabel: z.string().min(1),
  n: z.number().int().positive().optional(),
  max: z.number().int().positive().optional(),
})

export type AttemptKindInfo = z.infer<typeof attemptKindInfoSchema>

const DEFAULT_RETRY_MAX = 3
const DEFAULT_REPEAT_MAX = 5

export type AttemptLike = {
  attempt: number
  exitCode?: number
  interrupted?: boolean
}

function retryMax(task: Task): number {
  return task.retry?.max ?? DEFAULT_RETRY_MAX
}

function repeatMax(task: Task): number {
  return task.repeat?.max ?? DEFAULT_REPEAT_MAX
}

function failed(a: AttemptLike): boolean {
  return (
    a.interrupted === true || (a.exitCode !== undefined && a.exitCode !== 0)
  )
}

function succeeded(a: AttemptLike): boolean {
  return a.exitCode === 0 && !a.interrupted
}

/**
 * Derive DES-009 attempt kind from prior attempts and the task policy.
 * Manual retry is reserved for BL-012; not produced here yet.
 */
export function deriveAttemptKind(
  task: Task,
  attempts: AttemptLike[],
  index: number
): AttemptKindInfo {
  const current = attempts[index]
  if (!current) {
    return { kind: "run", label: "Run", ariaLabel: "First run" }
  }
  if (current.interrupted) {
    return {
      kind: "interrupted",
      label: "Interrupted",
      ariaLabel: "Interrupted by a restart",
    }
  }
  if (index === 0) {
    return { kind: "run", label: "Run", ariaLabel: "First run" }
  }

  const prior = attempts.slice(0, index)
  const priorFailures = prior.filter(failed).length
  const priorSuccesses = prior.filter(succeeded).length
  const last = prior[prior.length - 1]

  if (last && failed(last) && task.retry) {
    const n = priorFailures + 1
    const max = retryMax(task)
    const reason =
      last.interrupted === true
        ? "after interrupt"
        : `after exit code ${last.exitCode ?? "?"}`
    return {
      kind: "retry",
      label: `Retry ${n}/${max}`,
      ariaLabel: `Retry ${n} of ${max} ${reason}`,
      n,
      max,
    }
  }

  if (last && succeeded(last) && task.repeat) {
    const n = priorSuccesses + 1
    const max = repeatMax(task)
    return {
      kind: "repeat",
      label: `Repeat ${n}/${max}`,
      ariaLabel: `Repeat ${n} of ${max}`,
      n,
      max,
    }
  }

  return { kind: "run", label: "Run", ariaLabel: "Run" }
}
