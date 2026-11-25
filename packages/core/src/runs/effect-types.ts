/** Where a notice shows: in the app only, or also as a system notification. */
export type NoticeChannel = "app" | "system"

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
      notice?: { title: string; text: string; channel?: NoticeChannel }
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
