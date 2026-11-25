import { PassThrough } from "node:stream"
import { describe, expect, it } from "vitest"
import { RpcPeer } from "@workspace/protocol"
import { ndjsonTransport } from "@workspace/protocol/node"
import { CANCELLED_PERMISSION_RESULT } from "./cancel.ts"
import { runFakeAgent } from "./testing/fake-agent.ts"
import { openAcpSession } from "./session.ts"
import {
  clientInfo,
  collect,
  cwd,
  sessionId,
  setupSteps,
  withSession,
} from "./session-test-helpers.ts"

const permissionParams = {
  sessionId,
  toolCall: {
    toolCallId: "tc1",
    title: "Write",
    kind: "edit",
    status: "pending",
  },
  options: [{ optionId: "allow-once", name: "Allow once", kind: "allow_once" }],
}

describe("openAcpSession", () => {
  it("abort sends session/cancel, cancels pending permission, ends cancelled", async () => {
    await withSession(
      {
        steps: [
          ...setupSteps({
            expect: { method: "session/prompt" },
            hold: true,
            clientRequests: [
              {
                method: "session/request_permission",
                params: permissionParams,
                expectResult: CANCELLED_PERMISSION_RESULT,
              },
            ],
          }),
          {
            expect: {
              method: "session/cancel",
              params: { sessionId },
              notification: true,
            },
            replyHeld: {
              method: "session/prompt",
              reply: { result: { stopReason: "cancelled" } },
            },
          },
        ],
      },
      async (session) => {
        const ac = new AbortController()
        const iter = session.prompt([{ type: "text", text: "hi" }], ac.signal)
        const eventsPromise = collect(iter)
        await new Promise<void>((r) => setTimeout(r, 20))
        ac.abort()
        await expect(eventsPromise).resolves.toEqual([
          { kind: "stop", reason: "cancelled" },
        ])
      }
    )
  })

  it("kills the process group when the agent ignores cancel past grace", async () => {
    const toAgent = new PassThrough()
    const toClient = new PassThrough()
    const agent = runFakeAgent(
      {
        steps: [
          ...setupSteps({
            expect: { method: "session/prompt" },
            hold: true,
          }),
          {
            expect: {
              method: "session/cancel",
              params: { sessionId },
              notification: true,
            },
          },
        ],
      },
      toAgent,
      toClient
    )
    const peer = new RpcPeer(ndjsonTransport(toClient, toAgent))
    let killCount = 0

    try {
      const session = await openAcpSession(peer, {
        cwd,
        clientInfo,
        cancelGraceMs: 30,
        kill: () => {
          killCount += 1
          peer.close()
        },
      })
      const ac = new AbortController()
      const eventsPromise = collect(
        session.prompt([{ type: "text", text: "hi" }], ac.signal)
      )
      await new Promise<void>((r) => setTimeout(r, 20))
      ac.abort()
      await expect(eventsPromise).resolves.toEqual([
        { kind: "stop", reason: "cancelled" },
      ])
      expect(killCount).toBe(1)
      await expect(agent.done).resolves.toBeUndefined()
    } finally {
      peer.close()
      agent.close()
    }
  })
})
