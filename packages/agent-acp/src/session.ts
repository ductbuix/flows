import type {
  AgentEvent,
  AgentSession,
  ContentBlock,
  Logger,
} from "@workspace/core"
import type { RpcPeer } from "@workspace/protocol"
import { CURSOR_ASK_QUESTION_METHOD } from "./ask-question.ts"
import { authenticateIfRequired } from "./authenticate.ts"
import {
  CANCELLED_ASK_QUESTION_RESULT,
  CANCELLED_PERMISSION_RESULT,
  cancelPendingRequests,
  DEFAULT_CANCEL_GRACE_MS,
  scheduleCancelKill,
  type PendingClientRequest,
} from "./cancel.ts"
import { attachFsHandlers } from "./fs.ts"
import { mapSessionUpdate, parseStopReason } from "./map-update.ts"

/** Client capabilities advertised on `initialize` (DES-041). */
export const ACP_CLIENT_CAPABILITIES = {
  fs: { readTextFile: true, writeTextFile: true },
  terminal: false,
} as const

export type OpenAcpSessionOptions = {
  cwd: string
  /**
   * Absolute roots for `fs/*` (default: `[cwd]`). Paths outside these
   * roots are rejected (DES-041 path policy).
   */
  allowedRoots?: readonly string[]
  mcpServers?: readonly unknown[]
  logger?: Logger
  signal?: AbortSignal
  clientInfo?: { name: string; version: string }
  protocolVersion?: number
  /** When set and listed in initialize authMethods, call authenticate. */
  authMethod?: string
  /** Wait after `session/cancel` before `kill` (default 5s). */
  cancelGraceMs?: number
  /** End the agent process group if it ignores `session/cancel`. */
  kill?: () => void
  /**
   * When the chain says ask (or host decides), resolve
   * `session/request_permission` (BL-146). Without this, requests park
   * until `session/cancel` answers `cancelled`.
   */
  handlePermission?: (params: unknown) => Promise<unknown>
  /**
   * Resolve Cursor `cursor/ask_question` (BL-147). Without this, asks
   * park until cancel answers `cancelled`.
   */
  handleAskQuestion?: (params: unknown) => Promise<unknown>
}

type QueueWaiter = {
  resolve: () => void
}

/**
 * Run `initialize` + `session/new` on an existing ACP peer and return a
 * session that maps `session/update` to `AgentEvent` (BL-137).
 */
export async function openAcpSession(
  peer: RpcPeer,
  options: OpenAcpSessionOptions
): Promise<AgentSession> {
  const protocolVersion = options.protocolVersion ?? 1
  const clientInfo = options.clientInfo ?? {
    name: "flows",
    version: "0.0.0",
  }

  const initResult = await peer.request(
    "initialize",
    {
      protocolVersion,
      clientCapabilities: ACP_CLIENT_CAPABILITIES,
      clientInfo,
    },
    { signal: options.signal }
  )

  if (options.authMethod) {
    await authenticateIfRequired(
      peer,
      options.authMethod,
      initResult,
      options.signal
    )
  }

  const created = await peer.request(
    "session/new",
    {
      cwd: options.cwd,
      mcpServers: options.mcpServers ?? [],
    },
    { signal: options.signal }
  )

  const sessionId =
    created &&
    typeof created === "object" &&
    "sessionId" in created &&
    typeof (created as { sessionId: unknown }).sessionId === "string"
      ? (created as { sessionId: string }).sessionId
      : undefined

  if (!sessionId) {
    throw new Error("session/new result missing sessionId")
  }

  return new AcpSession(peer, sessionId, options)
}

class AcpSession implements AgentSession {
  private closed = false
  private readonly pending = new Set<PendingClientRequest>()
  private readonly cancelGraceMs: number
  private readonly kill?: () => void
  private readonly logger?: Logger
  private readonly handlePermission?: (params: unknown) => Promise<unknown>
  private readonly handleAskQuestion?: (params: unknown) => Promise<unknown>
  private unsubPermission?: () => void
  private unsubAskQuestion?: () => void
  private unsubFs?: () => void

  constructor(
    private readonly peer: RpcPeer,
    readonly id: string,
    options: OpenAcpSessionOptions
  ) {
    this.cancelGraceMs = options.cancelGraceMs ?? DEFAULT_CANCEL_GRACE_MS
    this.kill = options.kill
    this.logger = options.logger
    this.handlePermission = options.handlePermission
    this.handleAskQuestion = options.handleAskQuestion
    this.unsubPermission = peer.onRequest(
      "session/request_permission",
      (params) =>
        this.onClientRequest(
          params,
          this.handlePermission,
          CANCELLED_PERMISSION_RESULT,
          "session/request_permission"
        )
    )
    this.unsubAskQuestion = peer.onRequest(
      CURSOR_ASK_QUESTION_METHOD,
      (params) =>
        this.onClientRequest(
          params,
          this.handleAskQuestion,
          CANCELLED_ASK_QUESTION_RESULT,
          CURSOR_ASK_QUESTION_METHOD
        )
    )
    this.unsubFs = attachFsHandlers(peer, {
      sessionId: id,
      allowedRoots: options.allowedRoots ?? [options.cwd],
    })
  }

  prompt(
    blocks: readonly ContentBlock[],
    signal: AbortSignal
  ): AsyncIterable<AgentEvent> {
    if (this.closed) {
      throw new Error("ACP session is closed")
    }
    return this.promptStream(blocks, signal)
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    cancelPendingRequests(this.pending)
    this.unsubPermission?.()
    this.unsubPermission = undefined
    this.unsubAskQuestion?.()
    this.unsubAskQuestion = undefined
    this.unsubFs?.()
    this.unsubFs = undefined
    this.peer.close()
  }

  private onClientRequest(
    params: unknown,
    handler: ((params: unknown) => Promise<unknown>) | undefined,
    cancelledResult: unknown,
    method: string
  ): Promise<unknown> {
    if (
      params &&
      typeof params === "object" &&
      "sessionId" in params &&
      (params as { sessionId: unknown }).sessionId !== this.id
    ) {
      return Promise.reject(new Error(`${method} wrong session`))
    }
    return new Promise((resolve, reject) => {
      const entry: PendingClientRequest = {
        resolve,
        cancelledResult,
      }
      this.pending.add(entry)
      if (!handler) return
      void handler(params).then(
        (result) => {
          if (!this.pending.has(entry)) return
          this.pending.delete(entry)
          resolve(result)
        },
        (err: unknown) => {
          if (!this.pending.has(entry)) return
          this.pending.delete(entry)
          reject(err)
        }
      )
    })
  }

  private async *promptStream(
    blocks: readonly ContentBlock[],
    signal: AbortSignal
  ): AsyncGenerator<AgentEvent> {
    const queue: AgentEvent[] = []
    let waiter: QueueWaiter | undefined
    let settled = false
    let settleError: unknown
    let stopReason: AgentEvent & { kind: "stop" }
    let cancelStarted = false
    let clearKill: (() => void) | undefined

    const wake = () => {
      const w = waiter
      waiter = undefined
      w?.resolve()
    }

    const onAbort = () => {
      if (cancelStarted) return
      cancelStarted = true
      this.peer.notify("session/cancel", { sessionId: this.id })
      cancelPendingRequests(this.pending)
      clearKill = scheduleCancelKill(
        this.cancelGraceMs,
        () => settled,
        this.kill
      )
      wake()
    }

    if (signal.aborted) onAbort()
    else signal.addEventListener("abort", onAbort)

    const unsub = this.peer.onNotification("session/update", (params) => {
      if (
        params &&
        typeof params === "object" &&
        "sessionId" in params &&
        (params as { sessionId: unknown }).sessionId !== this.id
      ) {
        return
      }
      const event = mapSessionUpdate(params, this.logger)
      if (!event) return
      queue.push(event)
      wake()
    })

    // Do not pass `signal`: ACP cancel is `session/cancel`, not `$/cancel_request`.
    const promptPromise = this.peer
      .request("session/prompt", { sessionId: this.id, prompt: blocks })
      .then(
        (result) => {
          const reason = parseStopReason(result)
          stopReason = { kind: "stop", reason }
          settled = true
          clearKill?.()
          wake()
        },
        (err: unknown) => {
          settleError = err
          settled = true
          clearKill?.()
          wake()
        }
      )

    try {
      while (true) {
        while (queue.length > 0) {
          yield queue.shift()!
        }
        if (settled) {
          while (queue.length > 0) {
            yield queue.shift()!
          }
          break
        }
        await new Promise<void>((resolve) => {
          waiter = { resolve }
        })
      }

      await promptPromise
      if (settleError) {
        if (cancelStarted) {
          yield { kind: "stop", reason: "cancelled" }
          return
        }
        throw settleError
      }
      yield stopReason!
    } finally {
      signal.removeEventListener("abort", onAbort)
      clearKill?.()
      unsub()
    }
  }
}
