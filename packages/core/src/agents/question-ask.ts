import {
  inboxQuestionOptionIdSchema,
  type CursorAskAnswer,
  type CursorAskQuestion,
  type EngineEvent,
} from "@workspace/contracts"
import type { Clock } from "../kernel/clock.ts"
import { questionItemId } from "../inbox/projection-question.ts"

export type QuestionOutcome = "answered" | "skipped"

/** Map an Inbox answer to the ACP `cursor/ask_question` result. */
export function askQuestionResult(
  outcome: QuestionOutcome,
  answers?: readonly CursorAskAnswer[],
  reason?: string
): {
  outcome:
    | {
        outcome: "answered"
        answers: CursorAskAnswer[]
      }
    | { outcome: "skipped"; reason?: string }
} {
  if (outcome === "answered") {
    return {
      outcome: {
        outcome: "answered",
        answers: [...(answers ?? [])],
      },
    }
  }
  return {
    outcome: {
      outcome: "skipped",
      ...(reason !== undefined ? { reason } : {}),
    },
  }
}

export const CANCELLED_ASK_QUESTION_RESULT = {
  outcome: { outcome: "cancelled" as const },
}

/** True when every question has valid selected option ids (multi-select ok). */
export function validateAskAnswers(
  questions: readonly CursorAskQuestion[],
  answers: readonly CursorAskAnswer[]
): boolean {
  if (answers.length !== questions.length) return false
  const byId = new Map(answers.map((a) => [a.questionId, a]))
  for (const q of questions) {
    const a = byId.get(q.id)
    if (!a) return false
    if (!q.allowMultiple && a.selectedOptionIds.length > 1) return false
    const allowed = new Set(q.options.map((o) => o.id))
    if (!a.selectedOptionIds.every((id) => allowed.has(id))) return false
  }
  return true
}

export type QuestionAskOpen = {
  runId: string
  nodeId: string
  pass: number
  requestId: string
  title?: string
  questions: readonly CursorAskQuestion[]
  at?: string
}

type Pending = {
  resolve: (result: {
    outcome: QuestionOutcome
    answers?: CursorAskAnswer[]
    reason?: string
  }) => void
  questions: readonly CursorAskQuestion[]
}

export type QuestionAskGateDeps = {
  clock: Clock
  onRequested: (
    event: Extract<EngineEvent, { type: "question_asked" }>
  ) => void | Promise<void>
}

export function createQuestionAskGate(
  deps: QuestionAskGateDeps
): QuestionAskGate {
  return new QuestionAskGate(deps)
}

/**
 * Parks Cursor ask_question as Inbox items until answered or skipped
 * (DES-041 / BL-147). Cancel is handled by the ACP session.
 */
export class QuestionAskGate {
  private readonly pending = new Map<string, Pending>()

  constructor(private readonly deps: QuestionAskGateDeps) {}

  async ask(input: QuestionAskOpen): Promise<{
    outcome: QuestionOutcome
    answers?: CursorAskAnswer[]
    reason?: string
  }> {
    const at = input.at ?? new Date(this.deps.clock.now()).toISOString()
    const itemId = questionItemId(
      input.runId,
      input.nodeId,
      input.pass,
      input.requestId
    )
    const event: Extract<EngineEvent, { type: "question_asked" }> = {
      type: "question_asked",
      runId: input.runId,
      at,
      nodeId: input.nodeId,
      pass: input.pass,
      requestId: input.requestId,
      questions: [...input.questions],
      ...(input.title !== undefined ? { title: input.title } : {}),
    }
    await this.deps.onRequested(event)

    return await new Promise((resolve) => {
      this.pending.set(itemId, {
        resolve,
        questions: input.questions,
      })
    })
  }

  /**
   * Resolve a parked ask from `inbox/answer` / dismiss.
   * Returns false when unknown, already settled, or answers invalid.
   */
  answer(
    itemId: string,
    optionId: string,
    answers?: readonly CursorAskAnswer[]
  ): boolean {
    const parsed = inboxQuestionOptionIdSchema.safeParse(optionId)
    if (!parsed.success) return false
    const entry = this.pending.get(itemId)
    if (!entry) return false
    if (parsed.data === "answered") {
      if (!answers || !validateAskAnswers(entry.questions, answers)) {
        return false
      }
      this.pending.delete(itemId)
      entry.resolve({ outcome: "answered", answers: [...answers] })
      return true
    }
    this.pending.delete(itemId)
    entry.resolve({ outcome: "skipped" })
    return true
  }

  /** Drop parked asks; ACP cancel answers the peer with `cancelled`. */
  cancelAll(): void {
    this.pending.clear()
  }

  has(itemId: string): boolean {
    return this.pending.has(itemId)
  }
}

/** Parse Cursor `cursor/ask_question` params. */
export function parseAskQuestionParams(params: unknown): {
  requestId: string
  title?: string
  questions: CursorAskQuestion[]
} | null {
  if (!params || typeof params !== "object") return null
  const p = params as Record<string, unknown>
  const requestId =
    typeof p.toolCallId === "string" && p.toolCallId.length > 0
      ? p.toolCallId
      : null
  if (!requestId || !Array.isArray(p.questions) || p.questions.length === 0) {
    return null
  }
  const questions: CursorAskQuestion[] = []
  for (const raw of p.questions) {
    if (!raw || typeof raw !== "object") return null
    const q = raw as Record<string, unknown>
    if (typeof q.id !== "string" || typeof q.prompt !== "string") return null
    if (!Array.isArray(q.options) || q.options.length === 0) return null
    const options = []
    for (const o of q.options) {
      if (!o || typeof o !== "object") return null
      const opt = o as Record<string, unknown>
      if (typeof opt.id !== "string" || typeof opt.label !== "string") {
        return null
      }
      options.push({ id: opt.id, label: opt.label })
    }
    questions.push({
      id: q.id,
      prompt: q.prompt,
      options,
      ...(typeof q.allowMultiple === "boolean"
        ? { allowMultiple: q.allowMultiple }
        : {}),
    })
  }
  return {
    requestId,
    questions,
    ...(typeof p.title === "string" ? { title: p.title } : {}),
  }
}
