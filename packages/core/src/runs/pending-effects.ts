import type { RunEffect, RunState, StepState } from "./model.ts"
import { activeInputs, effectForRun } from "./decide-effects.ts"

function attemptKey(nodeId: string, pass: number, attempt: number): string {
  return `${nodeId}:${pass}:${attempt}`
}

/** Stable key for an effect (idempotent re-issue by step attempt id). */
export function effectAttemptKey(effect: RunEffect): string {
  if (effect.kind === "launch_step") {
    return attemptKey(effect.nodeId, effect.pass, effect.attempt)
  }
  return `${effect.kind}:${effect.nodeId}:${effect.pass}`
}

/**
 * Effects whose result event is missing after a crash (DES-041).
 * Idempotent by step attempt id: open attempts and steps that started
 * but never got an attempt are re-issued once.
 */
export function pendingEffects(state: RunState): RunEffect[] {
  const out: RunEffect[] = []
  const seen = new Set<string>()

  for (const list of Object.values(state.steps.steps)) {
    for (const step of list) {
      const fx = effectForStep(state, step)
      if (!fx) continue
      const key = effectAttemptKey(fx)
      if (seen.has(key)) continue
      seen.add(key)
      out.push(fx)
    }
  }
  return out
}

function effectForStep(state: RunState, step: StepState): RunEffect | null {
  if (step.status === "waiting") {
    return {
      kind: "post_inbox",
      nodeId: step.nodeId,
      pass: step.pass,
      question: step.question ?? "Approve?",
    }
  }
  if (step.status !== "running") return null

  if (step.current?.open) {
    return {
      kind: "launch_step",
      nodeId: step.nodeId,
      pass: step.pass,
      attempt: step.current.attempt,
    }
  }

  // step_started (or retry) with no attempt yet — effect never ran.
  if (!step.current) {
    const inputs = activeInputs(state, step.nodeId)
    const attempt = Math.max(1, step.attempts || 1)
    return effectForRun(state, step.nodeId, step.pass, inputs, attempt)
  }

  return null
}
