import { describe, expect, it } from "vitest"
import { toAcpBlock } from "./session.ts"
import {
  collect,
  sessionId,
  setupSteps,
  updateNote,
  withSession,
} from "./session-test-helpers.ts"

describe("openAcpSession", () => {
  it("maps each session/update kind and ends on stopReason", async () => {
    await withSession(
      {
        steps: setupSteps({
          expect: {
            method: "session/prompt",
            params: {
              sessionId,
              prompt: [{ type: "text", text: "hi" }],
            },
          },
          reply: { result: { stopReason: "end_turn" } },
          notifyBefore: true,
          notifications: [
            updateNote({
              sessionUpdate: "agent_message_chunk",
              content: { type: "text", text: "Hello" },
            }),
            updateNote({
              sessionUpdate: "agent_thought_chunk",
              content: { type: "text", text: "thinking" },
            }),
            updateNote({
              sessionUpdate: "tool_call",
              toolCallId: "call_1",
              title: "Read file",
              kind: "read",
              status: "pending",
            }),
            updateNote({
              sessionUpdate: "tool_call_update",
              toolCallId: "call_1",
              status: "completed",
              content: [
                { type: "content", content: { type: "text", text: "ok" } },
              ],
            }),
            updateNote({
              sessionUpdate: "plan",
              entries: [
                { content: "Step one", status: "pending", priority: "high" },
              ],
            }),
            updateNote({
              sessionUpdate: "usage_update",
              used: 100,
              size: 1000,
              cost: { amount: 0.01, currency: "USD" },
            }),
          ],
        }),
      },
      async (session) => {
        const events = await collect(
          session.prompt(
            [{ type: "text", text: "hi" }],
            new AbortController().signal
          )
        )
        expect(events).toEqual([
          { kind: "message_chunk", text: "Hello" },
          { kind: "thought_chunk", text: "thinking" },
          {
            kind: "tool_call",
            id: "call_1",
            title: "Read file",
            toolKind: "read",
            status: "pending",
          },
          {
            kind: "tool_call_update",
            id: "call_1",
            status: "completed",
            content: [
              { type: "content", content: { type: "text", text: "ok" } },
            ],
          },
          {
            kind: "plan",
            entries: [
              { content: "Step one", status: "pending", priority: "high" },
            ],
          },
          {
            kind: "usage",
            used: 100,
            size: 1000,
            cost: { amount: 0.01, currency: "USD" },
          },
          { kind: "stop", reason: "end_turn" },
        ])
      }
    )
  })

  it("ignores and logs unknown update kinds", async () => {
    await withSession(
      {
        steps: setupSteps({
          expect: { method: "session/prompt" },
          reply: { result: { stopReason: "refusal" } },
          notifyBefore: true,
          notifications: [
            updateNote({
              sessionUpdate: "available_commands_update",
              availableCommands: [],
            }),
            updateNote({
              sessionUpdate: "agent_message_chunk",
              content: { type: "text", text: "kept" },
            }),
          ],
        }),
      },
      async (session, logger) => {
        const events = await collect(
          session.prompt(
            [{ type: "text", text: "x" }],
            new AbortController().signal
          )
        )
        expect(events).toEqual([
          { kind: "message_chunk", text: "kept" },
          { kind: "stop", reason: "refusal" },
        ])
        expect(
          logger.entries.some(
            (e) =>
              e.level === "warn" &&
              e.message.includes("unknown ACP session update") &&
              e.fields.sessionUpdate === "available_commands_update"
          )
        ).toBe(true)
      }
    )
  })
})

describe("toAcpBlock", () => {
  it("nests resource fields under resource", () => {
    expect(
      toAcpBlock({
        type: "resource",
        uri: "file://a",
        mimeType: "text/plain",
        text: "x",
      })
    ).toEqual({
      type: "resource",
      resource: { uri: "file://a", text: "x", mimeType: "text/plain" },
    })
    expect(toAcpBlock({ type: "text", text: "t" })).toEqual({
      type: "text",
      text: "t",
    })
  })
})
