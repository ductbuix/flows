import {
  inboxPermissionOptionIdSchema,
  type EngineEvent,
} from "@workspace/contracts"
import type { Clock } from "../kernel/clock.ts"
import { permissionItemId } from "../inbox/projection.ts"

/** ACP Cursor permission option ids (DES-041). */
export type PermissionOptionId = "allow-once" | "allow-always" | "reject-once"

/** Map an Inbox answer to the ACP `session/request_permission` result. */
export function selectedPermissionResult(optionId: PermissionOptionId): {
  outcome: { outcome: "selected"; optionId: PermissionOptionId }
} {
  return { outcome: { outcome: "selected", optionId } }
}

/** Parse node `autoReject` (`never` | `1h` | `24h` | ms). Null = wait forever. */
export function parseAutoRejectMs(
  value: string | number | undefined | null
): number | null {
  if (value == null || value === "" || value === "never") return null
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null
  }
  if (value === "1h") return 3_600_000
  if (value === "24h") return 86_400_000
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

export type PermissionAskOpen = {
  runId: string
  nodeId: string
  pass: number
  tool: string
  requestId: string
  question?: string
  /** Override clock for the event `at` (tests). */
  at?: string
  autoRejectMs?: number | null
}

type Pending = {
  resolve: (optionId: PermissionOptionId) => void
  clearTimer: () => void
}

export type PermissionAskGateDeps = {
  clock: Clock
  /**
   * Append `permission_requested` (and apply to the inbox projection).
   * The gate does not own the event store.
   */
  onRequested: (
    event: Extract<EngineEvent, { type: "permission_requested" }>
  ) => void | Promise<void>
  /**
   * When autoReject fires, append the answer the same way `inbox/answer` would
   * (so the item resolves and the step leaves `waiting`).
   */
  onAutoReject: (input: {
    itemId: string
    runId: string
    nodeId: string
    pass: number
    requestId: string
    at: string
  }) => void | Promise<void>
  /** Injectable timer for tests (default: real setTimeout). */
  setTimer?: (ms: number, fn: () => void) => () => void
}

/**
 * Parks ACP permission asks as Inbox items until answered or auto-rejected
 * (DES-041 rule 5 / BL-146).
 */
export function createPermissionAskGate(
  deps: PermissionAskGateDeps
): PermissionAskGate {
  return new PermissionAskGate(deps)
}

export class PermissionAskGate {
  private readonly pending = new Map<string, Pending>()
  private readonly setTimer: (ms: number, fn: () => void) => () => void

  constructor(private readonly deps: PermissionAskGateDeps) {
    this.setTimer =
      deps.setTimer ??
      ((ms, fn) => {
        const t = setTimeout(fn, ms)
        return () => clearTimeout(t)
      })
  }

  /**
   * Emit `permission_requested`, start autoReject if set, and wait for
   * `answer` / dismiss / autoReject.
   */
  async ask(input: PermissionAskOpen): Promise<PermissionOptionId> {
    const at = input.at ?? new Date(this.deps.clock.now()).toISOString()
    const itemId = permissionItemId(
      input.runId,
      input.nodeId,
      input.pass,
      input.requestId
    )
    const event: Extract<EngineEvent, { type: "permission_requested" }> = {
      type: "permission_requested",
      runId: input.runId,
      at,
      nodeId: input.nodeId,
      pass: input.pass,
      tool: input.tool,
      requestId: input.requestId,
      ...(input.question !== undefined ? { question: input.question } : {}),
    }
    await this.deps.onRequested(event)

    return await new Promise<PermissionOptionId>((resolve) => {
      let settled = false
      const finish = (optionId: PermissionOptionId) => {
        if (settled) return
        settled = true
        entry.clearTimer()
        this.pending.delete(itemId)
        resolve(optionId)
      }
      const entry: Pending = {
        resolve: finish,
        clearTimer: () => {},
      }
      this.pending.set(itemId, entry)

      const ms = input.autoRejectMs
      if (ms != null && ms > 0) {
        entry.clearTimer = this.setTimer(ms, () => {
          void Promise.resolve(
            this.deps.onAutoReject({
              itemId,
              runId: input.runId,
              nodeId: input.nodeId,
              pass: input.pass,
              requestId: input.requestId,
              at: new Date(this.deps.clock.now()).toISOString(),
            })
          ).then(() => finish("reject-once"))
        })
      }
    })
  }

  /**
   * Resolve a parked ask from `inbox/answer` / dismiss.
   * Returns false when the item is unknown or already settled.
   */
  answer(itemId: string, optionId: string): boolean {
    const parsed = inboxPermissionOptionIdSchema.safeParse(optionId)
    if (!parsed.success) return false
    const entry = this.pending.get(itemId)
    if (!entry) return false
    entry.resolve(parsed.data)
    return true
  }

  /** Drop timers; ACP cancel answers the peer with `cancelled`. */
  cancelAll(): void {
    for (const entry of this.pending.values()) entry.clearTimer()
    this.pending.clear()
  }

  has(itemId: string): boolean {
    return this.pending.has(itemId)
  }
}

/** Build a PermissionRequest tool id from ACP permission params. */
export function toolFromPermissionParams(params: unknown): {
  tool: string
  toolKind?: string
  question: string
  requestId: string
} {
  const p =
    params && typeof params === "object"
      ? (params as Record<string, unknown>)
      : {}
  const toolCall =
    p.toolCall && typeof p.toolCall === "object"
      ? (p.toolCall as Record<string, unknown>)
      : undefined
  const title =
    typeof toolCall?.title === "string"
      ? toolCall.title
      : typeof p.title === "string"
        ? p.title
        : "Permission"
  const toolKind =
    typeof toolCall?.kind === "string" ? toolCall.kind : undefined
  const toolCallId =
    typeof toolCall?.toolCallId === "string" ? toolCall.toolCallId : undefined
  const tool = toolCallId ?? toolKind ?? title
  const requestId = toolCallId ?? `${Date.now()}`
  return {
    tool,
    ...(toolKind !== undefined ? { toolKind } : {}),
    question: title,
    requestId,
  }
}
