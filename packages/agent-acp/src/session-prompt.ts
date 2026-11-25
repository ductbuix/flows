import type { AgentEvent, ContentBlock, Logger } from "@workspace/core"
import type { RpcPeer } from "@workspace/protocol"
import {
  cancelPendingRequests,
  scheduleCancelKill,
  type PendingClientRequest,
} from "./cancel.ts"
import { mapSessionUpdate, parseStopReason } from "./map-update.ts"

type QueueWaiter = {
  resolve: () => void
}

/** Session state a prompt stream reads and writes while it runs. */
export type PromptScope = {
  readonly peer: RpcPeer
  readonly sessionId: string
  readonly pending: Set<PendingClientRequest>
  readonly cancelGraceMs: number
  readonly kill?: () => void
  readonly logger?: Logger
  /** Slot the Cursor todo/task extensions emit into during a prompt. */
  readonly emitter: { emit?: (event: AgentEvent) => void }
}

/** Port blocks are flat; ACP embeds resources under `resource`. */
export function toAcpBlock(block: ContentBlock): unknown {
  if (block.type !== "resource") return block
  return {
    type: "resource",
    resource: {
      uri: block.uri,
      text: block.text ?? "",
      ...(block.mimeType ? { mimeType: block.mimeType } : {}),
    },
  }
}

export async function* streamPrompt(
  scope: PromptScope,
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

  const pushEvent = (event: AgentEvent) => {
    queue.push(event)
    wake()
  }
  scope.emitter.emit = pushEvent

  const onAbort = () => {
    if (cancelStarted) return
    cancelStarted = true
    scope.peer.notify("session/cancel", { sessionId: scope.sessionId })
    cancelPendingRequests(scope.pending)
    clearKill = scheduleCancelKill(
      scope.cancelGraceMs,
      () => settled,
      scope.kill
    )
    wake()
  }

  if (signal.aborted) onAbort()
  else signal.addEventListener("abort", onAbort)

  const unsub = scope.peer.onNotification("session/update", (params) => {
    if (
      params &&
      typeof params === "object" &&
      "sessionId" in params &&
      (params as { sessionId: unknown }).sessionId !== scope.sessionId
    ) {
      return
    }
    const event = mapSessionUpdate(params, scope.logger)
    if (!event) return
    pushEvent(event)
  })

  // Do not pass `signal`: ACP cancel is `session/cancel`, not `$/cancel_request`.
  const promptPromise = scope.peer
    .request("session/prompt", {
      sessionId: scope.sessionId,
      prompt: blocks.map(toAcpBlock),
    })
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
    if (scope.emitter.emit === pushEvent) scope.emitter.emit = undefined
    unsub()
  }
}
