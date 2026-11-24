import type { EngineEvent } from "@workspace/contracts"
import type {
  DecideOutput,
  EffectResult,
  RunState,
  StepState,
} from "./model.ts"
import { latestStep, retryMax } from "./model.ts"

export function decideEffectResult(
  state: RunState,
  input: {
    at: string
    nodeId: string
    pass: number
    result: EffectResult
    retryBackoffMs?: number
  }
): DecideOutput {
  const { result, at, nodeId, pass } = input
  const step = state.steps.steps[nodeId]?.find((s) => s.pass === pass)
  if (!step || (step.status !== "running" && step.status !== "waiting")) {
    return { events: [], effects: [] }
  }

  if ("waiting" in result && result.waiting) {
    return {
      events: [
        {
          type: "approval_requested",
          runId: state.runId,
          at,
          taskId: nodeId,
          nodeId,
          pass,
          question: result.question,
        },
      ],
      effects: [
        { kind: "post_inbox", nodeId, pass, question: result.question },
      ],
    }
  }

  if ("fix" in result && result.fix) {
    return {
      events: [],
      effects: [
        { kind: "launch_step", nodeId, pass, attempt: step.attempts + 1 },
      ],
    }
  }

  if ("ok" in result && result.ok) {
    const events: EngineEvent[] = [
      {
        type: "step_done",
        runId: state.runId,
        at,
        nodeId,
        pass,
        outputs: result.outputs ?? [],
        ...(result.branch ? { branch: result.branch } : {}),
        ...(result.answer ? { answer: result.answer } : {}),
      },
    ]
    const effects = result.notice
      ? [
          {
            kind: "notify" as const,
            nodeId,
            pass,
            title: result.notice.title,
            from: [] as const,
          },
        ]
      : []
    return { events, effects }
  }

  if ("ok" in result && !result.ok) {
    return settleFailure(state, step, at, result, input.retryBackoffMs)
  }

  return { events: [], effects: [] }
}

function settleFailure(
  state: RunState,
  step: StepState,
  at: string,
  result: Extract<EffectResult, { ok: false }>,
  retryBackoffMs = 2000
): DecideOutput {
  const node = state.graph.nodes.find((n) => n.id === step.nodeId)
  const max = node ? retryMax(node) : undefined
  const attemptInfo = result.attempt
  const attempts = attemptInfo?.attempt ?? step.attempts
  if (
    max !== undefined &&
    attempts < max &&
    (result.reason === "exit" || result.reason === "timeout")
  ) {
    const endedAt = attemptInfo?.endedAt ?? at
    const wait = retryBackoffMs * 2 ** (Math.max(1, attempts) - 1)
    if (Date.parse(at) < Date.parse(endedAt) + wait) {
      return { events: [], effects: [] }
    }
    return {
      events: attemptInfo
        ? [
            {
              type: "attempt_finished",
              runId: state.runId,
              at: endedAt,
              taskId: step.nodeId,
              nodeId: step.nodeId,
              pass: step.pass,
              attempt: attemptInfo.attempt,
              exitCode: attemptInfo.exitCode ?? 1,
              reason: result.reason,
            },
          ]
        : [],
      effects: [
        {
          kind: "launch_step",
          nodeId: step.nodeId,
          pass: step.pass,
          attempt: attempts + 1,
        },
      ],
    }
  }
  return {
    events: [
      {
        type: "step_failed",
        runId: state.runId,
        at,
        nodeId: step.nodeId,
        pass: step.pass,
        reason: result.reason,
      },
    ],
    effects: [],
  }
}

export function decideAnswer(
  state: RunState,
  input: {
    at: string
    nodeId: string
    pass: number
    decision: "approved" | "rejected"
  }
): DecideOutput {
  const step = latestStep(state.steps, input.nodeId)
  if (!step || step.pass !== input.pass || step.status !== "waiting") {
    return { events: [], effects: [] }
  }
  if (
    step.waitingKind === "permission" ||
    step.waitingKind === "question" ||
    step.waitingKind === "plan_review"
  ) {
    return { events: [], effects: [] }
  }
  if (input.decision === "rejected") {
    return {
      events: [
        {
          type: "step_rejected",
          runId: state.runId,
          at: input.at,
          nodeId: input.nodeId,
          pass: input.pass,
        },
      ],
      effects: [],
    }
  }
  return {
    events: [
      {
        type: "step_approved",
        runId: state.runId,
        at: input.at,
        nodeId: input.nodeId,
        pass: input.pass,
      },
    ],
    effects: [],
  }
}
