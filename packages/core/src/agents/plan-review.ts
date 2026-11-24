import {
  inboxPlanReviewOptionIdSchema,
  type CursorPlanTodo,
  type EngineEvent,
} from "@workspace/contracts"
import type { Clock } from "../kernel/clock.ts"
import { planReviewItemId } from "../inbox/projection-plan-review.ts"

export type PlanReviewOutcome = "accepted" | "rejected"

/** Map an Inbox answer to the ACP `cursor/create_plan` result. */
export function createPlanResult(
  outcome: PlanReviewOutcome,
  reason?: string
): {
  outcome: { outcome: "accepted" } | { outcome: "rejected"; reason?: string }
} {
  if (outcome === "accepted") {
    return { outcome: { outcome: "accepted" } }
  }
  return {
    outcome: {
      outcome: "rejected",
      ...(reason !== undefined ? { reason } : {}),
    },
  }
}

export const CANCELLED_CREATE_PLAN_RESULT = {
  outcome: { outcome: "cancelled" as const },
}

/** Default when the llm node omits `planReview` (DES-041 / BL-148). */
export function resolvePlanReview(
  value: "auto" | "ask" | undefined
): "auto" | "ask" {
  return value ?? "auto"
}

export type PlanReviewOpen = {
  runId: string
  nodeId: string
  pass: number
  requestId: string
  name?: string
  overview?: string
  plan: string
  todos: readonly CursorPlanTodo[]
  at?: string
}

type Pending = {
  resolve: (result: { outcome: PlanReviewOutcome; reason?: string }) => void
}

export type PlanReviewGateDeps = {
  clock: Clock
  onRequested: (
    event: Extract<EngineEvent, { type: "plan_review_requested" }>
  ) => void | Promise<void>
}

export function createPlanReviewGate(deps: PlanReviewGateDeps): PlanReviewGate {
  return new PlanReviewGate(deps)
}

/**
 * Parks Cursor create_plan as Inbox items until accepted or rejected
 * (DES-041 / BL-148). Cancel is handled by the ACP session.
 */
export class PlanReviewGate {
  private readonly pending = new Map<string, Pending>()

  constructor(private readonly deps: PlanReviewGateDeps) {}

  async ask(input: PlanReviewOpen): Promise<{
    outcome: PlanReviewOutcome
    reason?: string
  }> {
    const at = input.at ?? new Date(this.deps.clock.now()).toISOString()
    const itemId = planReviewItemId(
      input.runId,
      input.nodeId,
      input.pass,
      input.requestId
    )
    const event: Extract<EngineEvent, { type: "plan_review_requested" }> = {
      type: "plan_review_requested",
      runId: input.runId,
      at,
      nodeId: input.nodeId,
      pass: input.pass,
      requestId: input.requestId,
      plan: input.plan,
      todos: [...input.todos],
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.overview !== undefined ? { overview: input.overview } : {}),
    }
    await this.deps.onRequested(event)

    return await new Promise((resolve) => {
      this.pending.set(itemId, { resolve })
    })
  }

  /**
   * Resolve a parked plan from `inbox/answer` / dismiss.
   * Returns false when unknown or already settled.
   */
  answer(itemId: string, optionId: string, reason?: string): boolean {
    const parsed = inboxPlanReviewOptionIdSchema.safeParse(optionId)
    if (!parsed.success) return false
    const entry = this.pending.get(itemId)
    if (!entry) return false
    this.pending.delete(itemId)
    entry.resolve({
      outcome: parsed.data,
      ...(reason !== undefined ? { reason } : {}),
    })
    return true
  }

  /** Drop parked reviews; ACP cancel answers the peer with `cancelled`. */
  cancelAll(): void {
    this.pending.clear()
  }

  has(itemId: string): boolean {
    return this.pending.has(itemId)
  }
}

/** Parse Cursor `cursor/create_plan` params. */
export function parseCreatePlanParams(params: unknown): {
  requestId: string
  name?: string
  overview?: string
  plan: string
  todos: CursorPlanTodo[]
} | null {
  if (!params || typeof params !== "object") return null
  const p = params as Record<string, unknown>
  const requestId =
    typeof p.toolCallId === "string" && p.toolCallId.length > 0
      ? p.toolCallId
      : null
  if (!requestId || typeof p.plan !== "string" || p.plan.length === 0) {
    return null
  }
  if (!Array.isArray(p.todos)) return null
  const todos: CursorPlanTodo[] = []
  for (const raw of p.todos) {
    if (!raw || typeof raw !== "object") return null
    const t = raw as Record<string, unknown>
    if (typeof t.id !== "string" || typeof t.content !== "string") return null
    if (
      t.status !== "pending" &&
      t.status !== "in_progress" &&
      t.status !== "completed" &&
      t.status !== "cancelled"
    ) {
      return null
    }
    todos.push({ id: t.id, content: t.content, status: t.status })
  }
  return {
    requestId,
    plan: p.plan,
    todos,
    ...(typeof p.name === "string" && p.name.length > 0
      ? { name: p.name }
      : {}),
    ...(typeof p.overview === "string" && p.overview.length > 0
      ? { overview: p.overview }
      : {}),
  }
}
