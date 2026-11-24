import type {
  Effort,
  EngineEvent,
  ModelSource,
  RunStatus,
  Workflow,
  WorkflowEdge,
} from "@workspace/contracts"

/** Step states (DES-034). */
export type StepStatus =
  | "pending"
  | "running"
  | "waiting"
  | "done"
  | "failed"
  | "skipped"
  | "cancelled"

export type StepFailReason =
  | "exit"
  | "timeout"
  | "unclear"
  | "answer"
  | "loop_limit"
  | "conflict"
  | "rejected"

/** Latest attempt of a step (DES-034). */
export type AttemptInfo = {
  attempt: number
  startedAt: string
  pid?: number
  timeout?: number
  model?: string
  effort?: Effort
  modelSource?: ModelSource
  open: boolean
  exitCode?: number
  reason?: string
  interrupted?: boolean
  endedAt?: string
}

/** One pass of one node. */
export type StepState = {
  nodeId: string
  pass: number
  status: StepStatus
  attempts: number
  outputs?: string[]
  branch?: string
  answer?: Record<string, unknown>
  failReason?: StepFailReason
  question?: string
  /** Why the step is waiting (DES-041); drives recovery effects. */
  waitingKind?: "approval" | "permission" | "question" | "plan_review"
  decision?: "approved" | "rejected"
  current?: AttemptInfo
  reused?: boolean
  /** Position in the event log; later steps are newer. */
  seq: number
}

export type StepsState = {
  steps: Readonly<Record<string, readonly StepState[]>>
  ended: boolean
}

/** Folded run state (DES-041). */
export type RunState = {
  runId: string
  workflowId: string
  status: RunStatus
  graph: Workflow
  steps: StepsState
  trigger?: string
  only?: string
  from?: string
  startedAt?: string
  finishedAt?: string
  cancelRequested?: boolean
  deleted?: boolean
  workItemId?: string
  /** 1-based position after the last folded event. */
  seq: number
}

/** Effects the shell runs; results return as inputs (DES-041, BL-131). */
export type RunEffect =
  | { kind: "launch_step"; nodeId: string; pass: number; attempt: number }
  | { kind: "post_inbox"; nodeId: string; pass: number; question: string }
  | {
      kind: "write_output"
      nodeId: string
      pass: number
      from: readonly string[]
    }
  | {
      kind: "notify"
      nodeId: string
      pass: number
      title: string
      from: readonly string[]
    }

export type EffectResult =
  | {
      ok: true
      outputs?: string[]
      branch?: string
      answer?: Record<string, unknown>
      notice?: { title: string; text: string }
    }
  | {
      ok: false
      reason: "exit" | "timeout" | "unclear" | "answer"
      message?: string
      attempt?: {
        attempt: number
        exitCode?: number
        interrupted?: boolean
        endedAt: string
      }
    }
  | { waiting: true; question: string }
  | { fix: true }

/** Mailbox inputs (DES-041). `at` is the clock; decide never reads time. */
export type DecideInput =
  | {
      kind: "start"
      at: string
      runId: string
      graph: Workflow
      trigger?: string
      only?: string
      from?: string
      queued?: boolean
      workItemId?: string
      seed?: readonly EngineEvent[]
    }
  | {
      kind: "effect_result"
      at: string
      nodeId: string
      pass: number
      result: EffectResult
      retryBackoffMs?: number
    }
  | {
      kind: "answer"
      at: string
      nodeId: string
      pass: number
      decision: "approved" | "rejected"
    }
  | {
      kind: "permission_answer"
      at: string
      nodeId: string
      pass: number
      requestId: string
      optionId: "allow-once" | "allow-always" | "reject-once"
    }
  | {
      kind: "question_answer"
      at: string
      nodeId: string
      pass: number
      requestId: string
      outcome: "answered" | "skipped"
      answers?: readonly {
        questionId: string
        selectedOptionIds: string[]
      }[]
      reason?: string
    }
  | {
      kind: "plan_review_answer"
      at: string
      nodeId: string
      pass: number
      requestId: string
      outcome: "accepted" | "rejected"
      reason?: string
    }
  | { kind: "cancel"; at: string }
  | {
      kind: "agent_event"
      at: string
      nodeId: string
      pass: number
      event: { type: string }
    }
  | { kind: "wake"; at: string; retryBackoffMs?: number }

export type DecideOutput = {
  events: EngineEvent[]
  effects: RunEffect[]
}

export type WalkGraph = {
  nodes: readonly { id: string; kind: string }[]
  edges: readonly WorkflowEdge[]
}

export type WalkScope = {
  trigger: string
  only?: string
  loopPasses?: number
}

export type WalkAction =
  | { type: "run"; nodeId: string; pass: number; inputs: string[] }
  | { type: "skip"; nodeId: string; pass: number }
  | { type: "fail"; nodeId: string; pass: number; reason: "loop_limit" }

const OPEN: ReadonlySet<StepStatus> = new Set(["pending", "running", "waiting"])

export function isOpenStep(step: StepState): boolean {
  return OPEN.has(step.status)
}

export function latestStep(
  state: StepsState,
  nodeId: string
): StepState | undefined {
  const list = state.steps[nodeId]
  return list?.[list.length - 1]
}

export function emptySteps(): StepsState {
  return { steps: {}, ended: false }
}

/** Retry max from a node; undefined when it has no retry policy. */
export function retryMax(node: object): number | undefined {
  return (node as { retry?: { max: number } }).retry?.max
}
