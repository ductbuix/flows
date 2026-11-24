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
}

export type FakeAgentReply = { result: unknown } | { error: JsonRpcErrorObject }

/** One scripted exchange: expect inbound, optional reply / outbound. */
export type FakeAgentStep = {
  expect: FakeAgentExpect
  reply?: FakeAgentReply
  /** Match the request but delay the reply until a later `replyHeld`. */
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
}

export type FakeAgentHandle = {
  /** Resolves when every script step has run (or rejects on mismatch). */
  done: Promise<void>
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
  const pendingClientExpects = new Map<
    JsonRpcId,
    { expectResult: unknown; resolve: () => void; reject: (e: Error) => void }
  >()
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

  const sendClientRequests = (reqs: readonly FakeAgentClientRequest[]) => {
    for (const req of reqs) {
      const id = nextClientReqId++
      transport.send({
        jsonrpc: JSONRPC_VERSION,
        method: req.method,
        ...(req.params !== undefined ? { params: req.params } : {}),
        id,
      })
      if (req.expectResult !== undefined) {
        const wait = new Promise<void>((resolve, reject) => {
          pendingClientExpects.set(id, {
            expectResult: req.expectResult,
            resolve,
            reject,
          })
        })
        clientExpectWaits.push(wait)
      }
    }
  }

  const emitNotes = (step: FakeAgentStep) => {
    for (const note of step.notifications ?? [])
      sendNotification(transport, note)
  }

  const applyStep = (step: FakeAgentStep, requestId?: JsonRpcId) => {
    const notes = step.notifications ?? []
    if (step.notifyBefore) emitNotes(step)

    if (step.clientRequests) sendClientRequests(step.clientRequests)

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
    close() {
      transport.close()
    },
  }
}
