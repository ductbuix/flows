import type {
  AgentEvent,
  AgentSession,
  ContentBlock,
  Logger,
  TodoEntry,
} from "@workspace/core"
import type { RpcPeer } from "@workspace/protocol"
import { CURSOR_ASK_QUESTION_METHOD } from "./ask-question.ts"
import {
  CANCELLED_ASK_QUESTION_RESULT,
  CANCELLED_CREATE_PLAN_RESULT,
  CANCELLED_PERMISSION_RESULT,
  cancelPendingRequests,
  DEFAULT_CANCEL_GRACE_MS,
  type PendingClientRequest,
} from "./cancel.ts"
import { CURSOR_CREATE_PLAN_METHOD } from "./create-plan.ts"
import { attachCursorStreamExtensions } from "./cursor-stream-extensions.ts"
import { attachFsHandlers } from "./fs.ts"
import { handleClientRequest } from "./session-client-requests.ts"
import {
  extensionEnabled,
  type OpenAcpSessionOptions,
} from "./session-options.ts"
import { streamPrompt } from "./session-prompt.ts"
import { CURSOR_TASK_METHOD } from "./task.ts"
import { CURSOR_UPDATE_TODOS_METHOD } from "./update-todos.ts"

export class AcpSession implements AgentSession {
  private closed = false
  private readonly pending = new Set<PendingClientRequest>()
  private readonly emitter: { emit?: (event: AgentEvent) => void } = {}
  private readonly cancelGraceMs: number
  private readonly kill?: () => void
  private readonly logger?: Logger
  private readonly handlePermission?: (params: unknown) => Promise<unknown>
  private readonly handleAskQuestion?: (params: unknown) => Promise<unknown>
  private readonly handleCreatePlan?: (params: unknown) => Promise<unknown>
  private todos: TodoEntry[] = []
  private unsubPermission?: () => void
  private unsubAskQuestion?: () => void
  private unsubCreatePlan?: () => void
  private unsubStreamExt?: () => void
  private unsubFs?: () => void

  constructor(
    private readonly peer: RpcPeer,
    readonly id: string,
    options: OpenAcpSessionOptions
  ) {
    const requests = { sessionId: id, pending: this.pending }
    this.cancelGraceMs = options.cancelGraceMs ?? DEFAULT_CANCEL_GRACE_MS
    this.kill = options.kill
    this.logger = options.logger
    this.handlePermission = options.handlePermission
    this.handleAskQuestion = options.handleAskQuestion
    this.handleCreatePlan = options.handleCreatePlan
    this.unsubPermission = peer.onRequest(
      "session/request_permission",
      (params) =>
        handleClientRequest(
          requests,
          params,
          this.handlePermission,
          CANCELLED_PERMISSION_RESULT,
          "session/request_permission"
        )
    )
    if (extensionEnabled(options.extensions, CURSOR_ASK_QUESTION_METHOD)) {
      this.unsubAskQuestion = peer.onRequest(
        CURSOR_ASK_QUESTION_METHOD,
        (params) =>
          handleClientRequest(
            requests,
            params,
            this.handleAskQuestion,
            CANCELLED_ASK_QUESTION_RESULT,
            CURSOR_ASK_QUESTION_METHOD
          )
      )
    }
    if (extensionEnabled(options.extensions, CURSOR_CREATE_PLAN_METHOD)) {
      this.unsubCreatePlan = peer.onRequest(
        CURSOR_CREATE_PLAN_METHOD,
        (params) =>
          handleClientRequest(
            requests,
            params,
            this.handleCreatePlan,
            CANCELLED_CREATE_PLAN_RESULT,
            CURSOR_CREATE_PLAN_METHOD
          )
      )
    }
    if (
      extensionEnabled(options.extensions, CURSOR_UPDATE_TODOS_METHOD) ||
      extensionEnabled(options.extensions, CURSOR_TASK_METHOD)
    ) {
      this.unsubStreamExt = attachCursorStreamExtensions(peer, {
        getTodos: () => this.todos,
        setTodos: (todos) => {
          this.todos = todos
        },
        emit: (event) => this.emitter.emit?.(event),
      })
    }
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
    return streamPrompt(
      {
        peer: this.peer,
        sessionId: this.id,
        pending: this.pending,
        cancelGraceMs: this.cancelGraceMs,
        kill: this.kill,
        logger: this.logger,
        emitter: this.emitter,
      },
      blocks,
      signal
    )
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    cancelPendingRequests(this.pending)
    this.unsubPermission?.()
    this.unsubPermission = undefined
    this.unsubAskQuestion?.()
    this.unsubAskQuestion = undefined
    this.unsubCreatePlan?.()
    this.unsubCreatePlan = undefined
    this.unsubStreamExt?.()
    this.unsubStreamExt = undefined
    this.unsubFs?.()
    this.unsubFs = undefined
    this.peer.close()
  }
}
