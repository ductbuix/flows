import { describe, expect, it, vi } from "vitest"
import type { AgentEvent } from "../ports/agent-runtime.ts"
import { mapAgentEventToRunUpdate } from "./agent-update.ts"
import { createRunUpdateCoalescer } from "./coalesce.ts"

const ctx = { runId: "r-1", stepId: "llm" }

describe("mapAgentEventToRunUpdate", () => {
  it("maps message and thought chunks", () => {
    expect(
      mapAgentEventToRunUpdate({ kind: "message_chunk", text: "a" }, ctx)
    ).toEqual({
      kind: "agent_message_chunk",
      runId: "r-1",
      stepId: "llm",
      text: "a",
    })
    expect(
      mapAgentEventToRunUpdate({ kind: "thought_chunk", text: "t" }, ctx)
    ).toEqual({
      kind: "agent_thought_chunk",
      runId: "r-1",
      stepId: "llm",
      text: "t",
    })
  })

  it("maps tool_call, plan, usage; stop is null", () => {
    expect(
      mapAgentEventToRunUpdate(
        {
          kind: "tool_call",
          id: "c1",
          title: "Read",
          toolKind: "read",
          status: "pending",
        },
        ctx
      )
    ).toEqual({
      kind: "tool_call",
      runId: "r-1",
      stepId: "llm",
      id: "c1",
      title: "Read",
      toolKind: "read",
      status: "pending",
    })
    expect(
      mapAgentEventToRunUpdate(
        { kind: "plan", entries: [{ content: "one" }] },
        ctx
      )
    ).toEqual({
      kind: "plan",
      runId: "r-1",
      stepId: "llm",
      entries: [{ content: "one" }],
    })
    expect(
      mapAgentEventToRunUpdate({ kind: "usage", used: 1, size: 10 }, ctx)
    ).toEqual({
      kind: "usage",
      runId: "r-1",
      stepId: "llm",
      used: 1,
      size: 10,
    })
    expect(
      mapAgentEventToRunUpdate({ kind: "stop", reason: "end_turn" }, ctx)
    ).toBeNull()
  })
})

describe("createRunUpdateCoalescer", () => {
  it("merges chunk kinds within the window and never drops tool/plan", () => {
    const published: ReturnType<typeof mapAgentEventToRunUpdate>[] = []
    const timers: Array<{ cb: () => void; ms: number }> = []
    const coalescer = createRunUpdateCoalescer({
      publish: (u) => published.push(u),
      windowMs: 50,
      schedule: (cb, ms) => {
        timers.push({ cb, ms })
        return () => {
          const i = timers.findIndex((t) => t.cb === cb)
          if (i >= 0) timers.splice(i, 1)
        }
      },
    })

    const push = (event: AgentEvent) => {
      const update = mapAgentEventToRunUpdate(event, ctx)
      if (update) coalescer.push(update)
    }

    push({ kind: "message_chunk", text: "Hel" })
    push({ kind: "message_chunk", text: "lo" })
    expect(published).toEqual([])
    expect(timers).toHaveLength(1)
    expect(timers[0]?.ms).toBe(50)

    push({
      kind: "tool_call",
      id: "c1",
      title: "Read",
      toolKind: "read",
      status: "pending",
    })
    expect(published.map((p) => p?.kind)).toEqual([
      "agent_message_chunk",
      "tool_call",
    ])
    expect(published[0]).toMatchObject({ text: "Hello" })

    push({ kind: "thought_chunk", text: "a" })
    push({ kind: "thought_chunk", text: "b" })
    push({ kind: "plan", entries: [{ content: "done" }] })
    expect(published.map((p) => p?.kind)).toEqual([
      "agent_message_chunk",
      "tool_call",
      "agent_thought_chunk",
      "plan",
    ])
    expect(published[2]).toMatchObject({ text: "ab" })

    coalescer.dispose()
  })

  it("flushes remaining chunks on flush()", () => {
    const publish = vi.fn()
    const coalescer = createRunUpdateCoalescer({
      publish,
      schedule: () => () => {},
    })
    coalescer.push({
      kind: "agent_message_chunk",
      runId: "r-1",
      stepId: "llm",
      text: "x",
    })
    expect(publish).not.toHaveBeenCalled()
    coalescer.flush("r-1")
    expect(publish).toHaveBeenCalledWith({
      kind: "agent_message_chunk",
      runId: "r-1",
      stepId: "llm",
      text: "x",
    })
  })
})
