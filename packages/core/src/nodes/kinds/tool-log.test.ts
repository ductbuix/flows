import { describe, expect, it } from "vitest"
import type { LogEntry } from "../attempt-log.ts"
import { logToolEvent } from "./llm.ts"

describe("logToolEvent", () => {
  it("logs the command with its result when the call settles", () => {
    const logged: Omit<LogEntry, "at">[] = []
    const ctx = { log: (e: Omit<LogEntry, "at">) => logged.push(e) }
    const tools = new Map()
    logToolEvent(ctx, tools, {
      kind: "tool_call",
      id: "t1",
      title: "Run",
      toolKind: "execute",
      status: "pending",
      input: { command: "echo hi" },
    })
    logToolEvent(ctx, tools, {
      kind: "tool_call_update",
      id: "t1",
      status: "completed",
      output: { stdout: "hi\n", stderr: "", exitCode: 2 },
    })
    expect(logged).toHaveLength(2)
    expect(logged[1]).toMatchObject({
      id: "t1",
      command: "echo hi",
      status: "completed",
      text: "hi\nexit 2",
    })
  })
})
