import type {
  AgentEvent,
  AgentSession,
  ContentBlock,
  Logger,
} from "@workspace/core"
import type { RpcPeer } from "@workspace/protocol"
import { authenticateIfRequired } from "./authenticate.ts"
import { mapSessionUpdate, parseStopReason } from "./map-update.ts"

/** Client capabilities advertised on `initialize` (DES-041). */
export const ACP_CLIENT_CAPABILITIES = {
  fs: { readTextFile: true, writeTextFile: true },
  terminal: false,
} as const

export type OpenAcpSessionOptions = {
  cwd: string
  mcpServers?: readonly unknown[]
  logger?: Logger
  signal?: AbortSignal
  clientInfo?: { name: string; version: string }
  protocolVersion?: number
  /** When set and listed in initialize authMethods, call authenticate. */
  authMethod?: string
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

  return new AcpSession(peer, sessionId, options.logger)
}

class AcpSession implements AgentSession {
  private closed = false

  constructor(
    private readonly peer: RpcPeer,
    readonly id: string,
    private readonly logger?: Logger
  ) {}

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
    this.peer.close()
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

    const wake = () => {
      const w = waiter
      waiter = undefined
      w?.resolve()
    }

    const onAbort = () => wake()
    if (signal.aborted) {
      throw signal.reason instanceof Error
        ? signal.reason
        : new Error("prompt aborted")
    }
    signal.addEventListener("abort", onAbort)

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

    const promptPromise = this.peer
      .request(
        "session/prompt",
        { sessionId: this.id, prompt: blocks },
        { signal }
      )
      .then(
        (result) => {
          const reason = parseStopReason(result)
          stopReason = { kind: "stop", reason }
          settled = true
          wake()
        },
        (err: unknown) => {
          settleError = err
          settled = true
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
      if (settleError) throw settleError
      yield stopReason!
    } finally {
      signal.removeEventListener("abort", onAbort)
      unsub()
    }
  }
}
