import { describe, expect, it } from "vitest"
import { createFakeLogger } from "@workspace/core/testing"
import { mapSessionUpdate, parseStopReason } from "./map-update.ts"

describe("mapSessionUpdate", () => {
  it("maps each known sessionUpdate kind", () => {
    expect(
      mapSessionUpdate({
        sessionId: "s",
        update: {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: "hi" },
        },
      })
    ).toEqual({ kind: "message_chunk", text: "hi" })

    expect(
      mapSessionUpdate({
        sessionId: "s",
        update: {
          sessionUpdate: "agent_thought_chunk",
          content: { type: "text", text: "hmm" },
        },
      })
    ).toEqual({ kind: "thought_chunk", text: "hmm" })

    expect(
      mapSessionUpdate({
        sessionId: "s",
        update: {
          sessionUpdate: "tool_call",
          toolCallId: "t1",
          title: "Run",
          kind: "execute",
          status: "in_progress",
        },
      })
    ).toEqual({
      kind: "tool_call",
      id: "t1",
      title: "Run",
      toolKind: "execute",
      status: "in_progress",
    })

    expect(
      mapSessionUpdate({
        sessionId: "s",
        update: {
          sessionUpdate: "tool_call_update",
          toolCallId: "t1",
          status: "completed",
        },
      })
    ).toEqual({ kind: "tool_call_update", id: "t1", status: "completed" })

    expect(
      mapSessionUpdate({
        sessionId: "s",
        update: {
          sessionUpdate: "plan",
          entries: [{ content: "a" }],
        },
      })
    ).toEqual({ kind: "plan", entries: [{ content: "a" }] })

    expect(
      mapSessionUpdate({
        sessionId: "s",
        update: {
          sessionUpdate: "usage_update",
          used: 1,
          size: 2,
        },
      })
    ).toEqual({ kind: "usage", used: 1, size: 2 })
  })

  it("logs and ignores unknown kinds", () => {
    const logger = createFakeLogger()
    expect(
      mapSessionUpdate(
        {
          sessionId: "s",
          update: { sessionUpdate: "notice", content: [] },
        },
        logger
      )
    ).toBeNull()
    expect(logger.entries[0]?.fields.sessionUpdate).toBe("notice")
  })
})

describe("parseStopReason", () => {
  it("reads stopReason from the prompt result", () => {
    expect(parseStopReason({ stopReason: "refusal" })).toBe("refusal")
  })

  it("throws when stopReason is missing", () => {
    expect(() => parseStopReason({})).toThrow(/stopReason/)
  })
})
