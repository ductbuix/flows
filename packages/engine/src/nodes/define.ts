import type { NodeWorkflow, WorkflowNode } from "@workspace/shared"

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
  /** Text of a node file frozen at run start (`text.md`), if any. */
  frozenFile(name: string): string | undefined
}

/** A no-process step settles at once; process kinds join in BL-091. */
export type ExecResult = {
  /** Paths relative to the run folder. */
  outputs: string[]
  branch?: string
  answer?: Record<string, unknown>
}

export type NodeExecutor = {
  kind: string
  run(ctx: ExecContext): ExecResult
}

/** Registers how a kind runs (DES-035). Runs must be safe to repeat. */
export function defineExecutor(def: NodeExecutor): NodeExecutor {
  return def
}
