import { z } from "zod"

export const attemptKindSchema = z.enum([
  "run",
  "retry",
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

export type AttemptLike = {
  attempt: number
  exitCode?: number
  interrupted?: boolean
  /** Set when attempt_started follows task_retry_requested (DES-011). */
  manualRetry?: boolean
}

/** The retry policy of a node, the only part of it an attempt label reads. */
export type RetrySpec = { retry?: { max?: number } }

function retryMax(task: RetrySpec): number {
  return task.retry?.max ?? DEFAULT_RETRY_MAX
}

function failed(a: AttemptLike): boolean {
  return (
    a.interrupted === true || (a.exitCode !== undefined && a.exitCode !== 0)
  )
}

/**
 * Derive DES-009 attempt kind from prior attempts and the task policy.
 * Manual retry (DES-011) wins over automatic retry/repeat labels.
 */
export function deriveAttemptKind(
  task: RetrySpec,
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
  if (current.manualRetry) {
    return {
      kind: "manual_retry",
      label: "Manual retry",
      ariaLabel: "Manual retry",
    }
  }
  if (index === 0) {
    return { kind: "run", label: "Run", ariaLabel: "First run" }
  }

  const prior = attempts.slice(0, index)
  const priorFailures = prior.filter(failed).length
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

  return { kind: "run", label: "Run", ariaLabel: "Run" }
}
