import type { z } from "zod"

/** Port types on a kind (DES-041). */
export type PortSpec = "text" | "image" | "any" | "file"

/** One file from an upstream port (or the run input for trigger). */
export type StepInput = {
  /** Source node id, or `"input"` for run start files. */
  from: string
  /** Store-relative path of the file. */
  path: string
  /** Path relative to the source step/input folder. */
  name: string
  text?: string
}

/**
 * Events a kind may yield while executing. Capabilities
 * (`inbox.ask`, `outputs.write`) do the I/O; yields report progress.
 */
export type StepEvent =
  | { kind: "output_written"; path: string }
  | { kind: "notify"; title: string; text: string }
  | { kind: "waiting"; question: string }
  | {
      kind: "done"
      outputs?: string[]
      branch?: string
      answer?: Record<string, unknown>
    }
  | {
      kind: "failed"
      reason: "exit" | "timeout" | "unclear" | "answer"
      /** Human-readable detail (e.g. missing pinned asset). */
      message?: string
    }

/** Thrown by `inbox.ask` when the step must park for a person. */
export class AskPending extends Error {
  readonly question: string
  constructor(question: string) {
    super(`waiting: ${question}`)
    this.name = "AskPending"
    this.question = question
  }
}

export function isAskPending(e: unknown): e is AskPending {
  return e instanceof AskPending
}

/**
 * Capabilities instead of raw ports (DES-041). `runDir` is store-relative.
 */
export type StepContext<S> = {
  settings: S
  inputs: readonly StepInput[]
  runDir: string
  /** Store-relative step folder: `nodes/<id>/pass-<n>` under the run. */
  stepDir: string
  signal: AbortSignal
  answers: Record<string, unknown>
  /** Set after `step_approved` / `step_rejected` for a waiting kind. */
  decision?: "approved" | "rejected"
  graph: { id: string; name?: string }
  node: { id: string; name?: string; pass: number }
  inbox: {
    ask(question: string): Promise<"approved" | "rejected">
  }
  outputs: {
    /** Write text under the step folder; returns the run-relative output path. */
    write(relPath: string, text: string): Promise<string>
  }
  /** Store-relative reads for fixed assets (pinned library / card files). */
  docs: {
    read(path: string): { text: string } | null
    list(glob: string): string[]
  }
}

/** One executor shape for every kind (DES-041, BL-134). */
export type NodeKind<S = unknown> = {
  kind: string
  settings: z.ZodType<S>
  ports: { in: PortSpec[]; out: PortSpec[] }
  execute(ctx: StepContext<S>): AsyncIterable<StepEvent>
}
