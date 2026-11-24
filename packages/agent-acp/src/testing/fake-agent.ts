import type { Readable, Writable } from "node:stream"
import {
  isJsonRpcRequest,
  JSONRPC_VERSION,
  type JsonRpcErrorObject,
  type JsonRpcId,
  type JsonRpcMessage,
  type JsonRpcRequest,
} from "@workspace/protocol"
import { ndjsonTransport, type NdjsonTransport } from "@workspace/protocol/node"

/** Expected inbound request from the client. */
export type FakeAgentExpect = {
  method: string
  /** When set, must deep-equal the request params. */
  params?: unknown
}

/** Outbound notification the fake sends (usually after the reply). */
export type FakeAgentNotification = {
  method: string
  params?: unknown
}

export type FakeAgentReply = { result: unknown } | { error: JsonRpcErrorObject }

/** One scripted exchange: expect a request, reply, optional notifies. */
export type FakeAgentStep = {
  expect: FakeAgentExpect
  reply: FakeAgentReply
  /** Sent after the reply unless `notifyBefore` is true. */
  notifications?: readonly FakeAgentNotification[]
  notifyBefore?: boolean
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

function matchRequest(
  msg: JsonRpcRequest,
  step: FakeAgentStep,
  index: number
): void {
  if (msg.method !== step.expect.method) {
    throw new Error(
      `fake-agent step ${index}: expected method ${step.expect.method}, got ${msg.method}`
    )
  }
  if (
    step.expect.params !== undefined &&
    !deepEqual(msg.params, step.expect.params)
  ) {
    throw new Error(
      `fake-agent step ${index}: params mismatch for ${msg.method}`
    )
  }
}

/**
 * Replay a JSON-RPC script as an ACP agent over stdio-shaped streams
 * (DES-042). Each step expects one client request, then replies and
 * optionally emits notifications.
 */
export function runFakeAgent(
  script: FakeAgentScript,
  readable: Readable,
  writable: Writable
): FakeAgentHandle {
  const transport = ndjsonTransport(readable, writable)
  let stepIndex = 0
  let settle!: (err?: Error) => void
  let settled = false
  const done = new Promise<void>((resolve, reject) => {
    settle = (err) => {
      if (settled) return
      settled = true
      if (err) reject(err)
      else resolve()
    }
  })

  const finishOk = () => {
    if (stepIndex >= script.steps.length) settle()
  }

  const fail = (err: Error) => {
    settle(err)
    transport.close()
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
    if (settled || !isJsonRpcRequest(msg)) return

    const step = script.steps[stepIndex]
    if (!step) {
      fail(
        new Error(
          `fake-agent: unexpected request ${msg.method} after script ended`
        )
      )
      return
    }

    try {
      matchRequest(msg, step, stepIndex)
      const notes = step.notifications ?? []
      if (step.notifyBefore) {
        for (const note of notes) sendNotification(transport, note)
      }
      sendReply(transport, msg.id, step.reply)
      if (!step.notifyBefore) {
        for (const note of notes) sendNotification(transport, note)
      }
      stepIndex += 1
      finishOk()
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
