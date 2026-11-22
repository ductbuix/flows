import type {
  Effort,
  ModelSource,
  NodeWorkflow,
  WorkflowNode,
} from "@workspace/shared"

/** One active input of a step: the source node and its step folder. */
export type ExecInput = {
  nodeId: string
  kind: string
  /** Absolute path of the source step's folder. */
  dir: string
}

export type ExecContext = {
  /** The frozen graph from `run_started`. */
  graph: NodeWorkflow
  node: WorkflowNode
  pass: number
  runRoot: string
  /** Absolute step folder: `nodes/<nodeId>/pass-<p>` under the run. */
  stepDir: string
  /** Active inputs in edge file order. */
  inputs: ExecInput[]
  /** Absolute workflow folder, the sandbox write root. */
  workflowRoot: string
  /** Text of a node file frozen at run start (`text.md`), if any. */
  frozenFile(name: string): string | undefined
  /** Absolute path of a node file frozen at run start. */
  frozenPath(name: string): string
}

/** A no-process step settles at once. */
export type ExecResult = {
  /** Paths relative to the run folder. */
  outputs: string[]
  branch?: string
  answer?: Record<string, unknown>
  /** The step fails with this reason instead of settling (Judge: `unclear`). */
  failed?: "unclear"
}

/**
 * What a process kind asks the engine to start. The launcher owns the
 * attempt folder, `input/`, env, limits, timeout,
 * watching and resume; the kind only says what to run (DES-035).
 */
export type LaunchSpec = {
  /** Counts against `limits.agents` (a CLI step). */
  agent: boolean
  cli?: "claude" | "cursor"
  /** Resolved model and effort for `attempt_launched`. */
  modelFields?: { model?: string; effort?: Effort; modelSource: ModelSource }
  /** Absolute path exported as `NODE_INSTRUCTIONS`. */
  instructions?: string
  /** Runs before `attempt_started`; throw to fail the attempt. */
  prepare?(a: { attemptRoot: string; inputDir: string }): void
  /** Shell command, working directory and sandbox needs of one attempt. */
  command(a: { attemptRoot: string }): {
    shell: string
    cwd: "attempt" | "workflow"
    allowCursorHome?: boolean
    /** Sandbox writes only the attempt folder, not the whole workflow. */
    writeAttemptOnly?: boolean
  }
}

export type LaunchPlan = { launch: LaunchSpec }

/** The step waits for a person: the tick appends `approval_requested` (BL-080). */
export type WaitPlan = { wait: { question: string } }

export type NodeExecutor = {
  kind: string
  /** A no-process kind settles at once; a process kind returns a plan. */
  run(ctx: ExecContext): ExecResult | LaunchPlan | WaitPlan
  /** Process kinds: reads a finished attempt into the step output. */
  finish?(ctx: ExecContext, attemptRoot: string): ExecResult
  /** Waiting kinds: settles the step once a person approved it. */
  approved?(ctx: ExecContext): ExecResult
}

export function isLaunchPlan(
  r: ExecResult | LaunchPlan | WaitPlan
): r is LaunchPlan {
  return "launch" in r
}

export function isWaitPlan(r: ExecResult | LaunchPlan | WaitPlan): r is WaitPlan {
  return "wait" in r
}

/** Registers how a kind runs (DES-035). Runs must be safe to repeat. */
export function defineExecutor(def: NodeExecutor): NodeExecutor {
  return def
}
