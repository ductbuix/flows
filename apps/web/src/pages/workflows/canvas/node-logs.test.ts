import { describe, expect, it } from "vitest"
import { parseEntries, parseTrace, showsLogButton } from "./node-logs"

describe("showsLogButton", () => {
  it("shows for started process kinds only", () => {
    expect(showsLogButton("command", "done")).toBe(true)
    expect(showsLogButton("llm", "failed")).toBe(true)
    expect(showsLogButton("agent", "running")).toBe(true)
  })
  it("hides for kinds that run nothing locally", () => {
    for (const k of [
      "trigger",
      "output",
      "approval",
      "judge",
      "asset",
      "prompt",
    ] as const) {
      expect(showsLogButton(k, "done")).toBe(false)
    }
  })
  it("hides before the node starts", () => {
    expect(showsLogButton("llm", undefined)).toBe(false)
    expect(showsLogButton("llm", "waiting")).toBe(false)
    expect(showsLogButton("llm", "skipped")).toBe(false)
  })
})

describe("parseTrace", () => {
  it("splits headline and frames", () => {
    const t = parseTrace(
      "Error: boom\n    at a (x.ts:1:1)\n    at b (y.ts:2:2)"
    )
    expect(t.error).toBe("Error: boom")
    expect(t.frames).toEqual(["at a (x.ts:1:1)", "at b (y.ts:2:2)"])
  })
  it("keeps plain text as the error", () => {
    expect(parseTrace("exit 1")).toEqual({ error: "exit 1", frames: [] })
  })
})

describe("parseEntries", () => {
  it("sorts newest first, ties by later line, and skips bad lines", () => {
    const a = { at: "2026-01-01T00:00:01.000Z", kind: "command", title: "ls" }
    const b = {
      at: "2026-01-01T00:00:03.000Z",
      kind: "command",
      title: "Exit 0",
    }
    const c = { at: "2026-01-01T00:00:03.000Z", kind: "tool_call", title: "x" }
    const text = [a, b, c].map((e) => JSON.stringify(e)).join("\n") + "\n{bad"
    expect(parseEntries(text).map((e) => e.title)).toEqual([
      "x",
      "Exit 0",
      "ls",
    ])
  })
})
