import type { Readable, Writable } from "node:stream"
import {
  isJsonRpcNotification,
  isJsonRpcRequest,
  isJsonRpcResponse,
  JSONRPC_VERSION,
  type JsonRpcErrorObject,
  type JsonRpcId,
  type JsonRpcMessage,
  type JsonRpcRequest,
} from "@workspace/protocol"
import { ndjsonTransport, type NdjsonTransport } from "@workspace/protocol/node"

/** Expected inbound request or notification from the client. */
export type FakeAgentExpect = {
  method: string
  /** When set, must deep-equal the request params. */
  params?: unknown
  /** When true, match a notification (no id) instead of a request. */
  notification?: boolean
}

/** Outbound notification the fake sends (usually after the reply). */
export type FakeAgentNotification = {
  method: string
  params?: unknown
}

/** Outbound request the fake sends to the client. */
export type FakeAgentClientRequest = {
  method: string
  params?: unknown
  /** When set, the client reply result must deep-equal this. */
  expectResult?: unknown
  /**
   * When set, the client must reply with an error. `true` accepts any
   * error; an object matches `code` and/or a message substring.
   */
  expectError?: true | { code?: number; messageIncludes?: string }
}

export type FakeAgentReply = { result: unknown } | { error: JsonRpcErrorObject }

/** One scripted exchange: expect inbound, optional reply / outbound. */
export type FakeAgentStep = {
  expect: FakeAgentExpect
  reply?: FakeAgentReply
  /**
   * Match the request but delay the reply until a later `replyHeld`,
   * or until this step's `clientRequests` expects resolve when `reply`
   * is also set (daemon integration / BL-192).
   */
  hold?: boolean
  /** Sent after the reply unless `notifyBefore` is true. */
  notifications?: readonly FakeAgentNotification[]
  notifyBefore?: boolean
  /** Requests sent to the client after matching (before hold/reply). */
  clientRequests?: readonly FakeAgentClientRequest[]
  /** Reply to a previously held request with this method. */
  replyHeld?: { method: string; reply: FakeAgentReply }
}

export type FakeAgentScript = {
  steps: readonly FakeAgentStep[]
  /**
   * When true, `done` waits until `close()` so the test can call
   * `requestClient` after the handshake script finishes.
   */
  waitForClose?: boolean
}

export type FakeAgentHandle = {
  /** Resolves when every script step has run (or rejects on mismatch). */
  done: Promise<void>
  /**
   * Send a request to the client outside the script (e.g. after
   * `session/new` so FS handlers are registered).
   */
  requestClient(req: FakeAgentClientRequest): Promise<void>
  close(): void
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    .join(",")}}`
}

function deepEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b)
}

function sendNotification(
  transport: NdjsonTransport,
  note: FakeAgentNotification
): void {
  const msg: JsonRpcMessage = {
    jsonrpc: JSONRPC_VERSION,
    method: note.method,
    ...(note.params !== undefined ? { params: note.params } : {}),
  }
  transport.send(msg)
}

function sendReply(
  transport: NdjsonTransport,
  id: JsonRpcId,
  reply: FakeAgentReply
): void {
  if ("error" in reply) {
    transport.send({ jsonrpc: JSONRPC_VERSION, id, error: reply.error })
    return
  }
  transport.send({ jsonrpc: JSONRPC_VERSION, id, result: reply.result })
}

function matchInbound(
  method: string,
  params: unknown,
  step: FakeAgentStep,
  index: number
): void {
  if (method !== step.expect.method) {
    throw new Error(
      `fake-agent step ${index}: expected method ${step.expect.method}, got ${method}`
    )
  }
  if (
    step.expect.params !== undefined &&
    !deepEqual(params, step.expect.params)
  ) {
    throw new Error(
      `fake-agent step ${index}: params mismatch for ${step.expect.method}`
    )
  }
}

/**
 * Replay a JSON-RPC script as an ACP agent over stdio-shaped streams
 * (DES-042). Each step expects one client request or notification, then
 * optionally replies and emits notifications or client requests.
 */
export function runFakeAgent(
  script: FakeAgentScript,
  readable: Readable,
  writable: Writable
): FakeAgentHandle {
  const transport = ndjsonTransport(readable, writable)
  let stepIndex = 0
  let nextClientReqId = 1
  let settle!: (err?: Error) => void
  let settled = false
  const held = new Map<string, JsonRpcId>()
  type ClientExpect = {
    expectResult?: unknown
    expectError?: FakeAgentClientRequest["expectError"]
    resolve: () => void
    reject: (e: Error) => void
  }
  const pendingClientExpects = new Map<JsonRpcId, ClientExpect>()
  const clientExpectWaits: Promise<void>[] = []

  const done = new Promise<void>((resolve, reject) => {
    settle = (err) => {
      if (settled) return
      settled = true
      if (err) reject(err)
      else resolve()
    }
  })

  const tryFinish = () => {
    if (stepIndex < script.steps.length) return
    if (pendingClientExpects.size > 0) return
    if (script.waitForClose) return
    void Promise.all(clientExpectWaits).then(
      () => settle(),
      (err: unknown) =>
        settle(err instanceof Error ? err : new Error(String(err)))
    )
  }

  const fail = (err: Error) => {
    settle(err)
    transport.close()
  }

  const sendOneClientRequest = (
    req: FakeAgentClientRequest
  ): Promise<void> | undefined => {
    const id = nextClientReqId++
    const msg: JsonRpcMessage = {
      jsonrpc: JSONRPC_VERSION,
      method: req.method,
      ...(req.params !== undefined ? { params: req.params } : {}),
      id,
    }
    // Register expect before send: Method not found replies sync on
    // PassThrough and would otherwise arrive before the map entry exists.
    if (req.expectResult === undefined && req.expectError === undefined) {
      transport.send(msg)
      return undefined
    }
    const wait = new Promise<void>((resolve, reject) => {
      pendingClientExpects.set(id, {
        expectResult: req.expectResult,
        expectError: req.expectError,
        resolve,
        reject,
      })
    })
    clientExpectWaits.push(wait)
    transport.send(msg)
    return wait
  }

  const sendClientRequests = (reqs: readonly FakeAgentClientRequest[]) => {
    for (const req of reqs) sendOneClientRequest(req)
  }

  const emitNotes = (step: FakeAgentStep) => {
    for (const note of step.notifications ?? [])
      sendNotification(transport, note)
  }

  const applyStep = (step: FakeAgentStep, requestId?: JsonRpcId) => {
    const notes = step.notifications ?? []
    if (step.notifyBefore) emitNotes(step)

    const waitStart = clientExpectWaits.length
    if (step.clientRequests) sendClientRequests(step.clientRequests)
    const stepWaits = clientExpectWaits.slice(waitStart)

    if (step.replyHeld) {
      const heldId = held.get(step.replyHeld.method)
      if (heldId === undefined) {
        throw new Error(
          `fake-agent: no held request for ${step.replyHeld.method}`
        )
      }
      held.delete(step.replyHeld.method)
      sendReply(transport, heldId, step.replyHeld.reply)
    }

    if (requestId !== undefined) {
      if (step.hold) {
        held.set(step.expect.method, requestId)
        // hold + reply: release after this step's client expects (BL-192).
        if (step.reply && stepWaits.length > 0) {
          const heldMethod = step.expect.method
          const reply = step.reply
          void Promise.all(stepWaits).then(
            () => {
              if (!held.has(heldMethod)) return
              held.delete(heldMethod)
              sendReply(transport, requestId, reply)
              if (!step.notifyBefore && notes.length > 0) emitNotes(step)
              tryFinish()
            },
            (err: unknown) =>
              fail(err instanceof Error ? err : new Error(String(err)))
          )
          return
        }
      } else if (step.reply) {
        sendReply(transport, requestId, step.reply)
      } else if (!step.expect.notification) {
        throw new Error(
          `fake-agent step ${stepIndex}: request ${step.expect.method} needs reply or hold`
        )
      }
    }

    if (!step.notifyBefore && notes.length > 0) emitNotes(step)
  }

  transport.onError((err) => fail(err))
  transport.onClose((err) => {
    if (settled) return
    if (err) settle(err)
    else if (stepIndex < script.steps.length) {
      settle(
        new Error(
          `fake-agent: closed after ${stepIndex}/${script.steps.length} steps`
        )
      )
    } else settle()
  })

  transport.onMessage((msg) => {
    if (settled) return

    if (isJsonRpcResponse(msg)) {
      if (msg.id === null || msg.id === undefined) return
      const pending = pendingClientExpects.get(msg.id)
      if (!pending) return
      pendingClientExpects.delete(msg.id)
      if (pending.expectError !== undefined) {
        if (!("error" in msg)) {
          pending.reject(
            new Error(
              `fake-agent: client request ${msg.id} expected error, got result`
            )
          )
          return
        }
        const want = pending.expectError
        if (want !== true) {
          if (want.code !== undefined && msg.error.code !== want.code) {
            pending.reject(
              new Error(
                `fake-agent: client request ${msg.id} error code ${msg.error.code}, want ${want.code}`
              )
            )
            return
          }
          if (
            want.messageIncludes !== undefined &&
            !msg.error.message.includes(want.messageIncludes)
          ) {
            pending.reject(
              new Error(
                `fake-agent: client request ${msg.id} error message mismatch`
              )
            )
            return
          }
        }
        pending.resolve()
        tryFinish()
        return
      }
      if ("error" in msg) {
        pending.reject(
          new Error(`fake-agent: client request ${msg.id} returned error`)
        )
        return
      }
      if (!deepEqual(msg.result, pending.expectResult)) {
        pending.reject(
          new Error(`fake-agent: client request ${msg.id} result mismatch`)
        )
        return
      }
      pending.resolve()
      tryFinish()
      return
    }

    const isNotification = isJsonRpcNotification(msg)
    const isRequest = isJsonRpcRequest(msg)
    if (!isNotification && !isRequest) return

    const step = script.steps[stepIndex]
    if (!step) {
      fail(
        new Error(
          `fake-agent: unexpected ${isRequest ? "request" : "notification"} ${msg.method} after script ended`
        )
      )
      return
    }

    const wantNotification = step.expect.notification === true
    if (wantNotification !== isNotification) {
      fail(
        new Error(
          `fake-agent step ${stepIndex}: expected ${wantNotification ? "notification" : "request"} ${step.expect.method}, got ${isRequest ? "request" : "notification"} ${msg.method}`
        )
      )
      return
    }

    try {
      matchInbound(msg.method, msg.params, step, stepIndex)
      applyStep(step, isRequest ? (msg as JsonRpcRequest).id : undefined)
      stepIndex += 1
      tryFinish()
    } catch (cause) {
      fail(cause instanceof Error ? cause : new Error(String(cause)))
    }
  })

  return {
    done,
    requestClient(req) {
      if (settled) {
        return Promise.reject(new Error("fake-agent: already settled"))
      }
      const wait = sendOneClientRequest(req)
      return wait ?? Promise.resolve()
    },
    close() {
      if (script.waitForClose && !settled) {
        void Promise.all(clientExpectWaits).then(
          () => settle(),
          (err: unknown) =>
            settle(err instanceof Error ? err : new Error(String(err)))
        )
      }
      transport.close()
    },
  }
}
