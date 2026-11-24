import { describe, expect, it } from "vitest"
import { createFakeClock } from "../testing/fake-clock.ts"
import {
  createPermissionAskGate,
  parseAutoRejectMs,
  selectedPermissionResult,
  toolFromPermissionParams,
} from "./permission-ask.ts"

describe("parseAutoRejectMs", () => {
  it("maps never / hours / numeric", () => {
    expect(parseAutoRejectMs(undefined)).toBeNull()
    expect(parseAutoRejectMs("never")).toBeNull()
    expect(parseAutoRejectMs("1h")).toBe(3_600_000)
    expect(parseAutoRejectMs("24h")).toBe(86_400_000)
    expect(parseAutoRejectMs(50)).toBe(50)
    expect(parseAutoRejectMs("50")).toBe(50)
  })
})

describe("selectedPermissionResult", () => {
  it("maps option ids to ACP selected outcomes", () => {
    expect(selectedPermissionResult("allow-once")).toEqual({
      outcome: { outcome: "selected", optionId: "allow-once" },
    })
    expect(selectedPermissionResult("allow-always")).toEqual({
      outcome: { outcome: "selected", optionId: "allow-always" },
    })
    expect(selectedPermissionResult("reject-once")).toEqual({
      outcome: { outcome: "selected", optionId: "reject-once" },
    })
  })
})

describe("toolFromPermissionParams", () => {
  it("reads toolCall id, kind and title", () => {
    expect(
      toolFromPermissionParams({
        toolCall: {
          toolCallId: "tc1",
          title: "Write",
          kind: "edit",
        },
      })
    ).toEqual({
      tool: "tc1",
      toolKind: "edit",
      question: "Write",
      requestId: "tc1",
    })
  })
})

describe("PermissionAskGate", () => {
  it("answers from gate.answer and clears pending", async () => {
    const requested: unknown[] = []
    const gate = createPermissionAskGate({
      clock: createFakeClock(Date.parse("2026-11-24T00:00:00.000Z")),
      onRequested: (e) => {
        requested.push(e)
      },
      onAutoReject: async () => {
        throw new Error("autoReject should not fire")
      },
    })

    const done = gate.ask({
      runId: "r1",
      nodeId: "llm",
      pass: 1,
      tool: "tc1",
      requestId: "tc1",
      question: "Write",
    })
    await Promise.resolve()
    expect(requested).toHaveLength(1)
    expect(gate.answer("permission:r1:llm:1:tc1", "allow-once")).toBe(true)
    await expect(done).resolves.toBe("allow-once")
    expect(gate.has("permission:r1:llm:1:tc1")).toBe(false)
  })

  it("autoReject resolves reject-once and calls onAutoReject", async () => {
    const timers: Array<() => void> = []
    const auto: unknown[] = []
    const gate = createPermissionAskGate({
      clock: createFakeClock(1_000),
      onRequested: async () => {},
      onAutoReject: (input) => {
        auto.push(input)
      },
      setTimer: (_ms, fn) => {
        timers.push(fn)
        return () => {}
      },
    })

    const done = gate.ask({
      runId: "r1",
      nodeId: "llm",
      pass: 1,
      tool: "edit",
      requestId: "req-1",
      autoRejectMs: 10,
    })
    await Promise.resolve()
    expect(timers).toHaveLength(1)
    timers[0]!()
    await expect(done).resolves.toBe("reject-once")
    expect(auto).toEqual([
      {
        itemId: "permission:r1:llm:1:req-1",
        runId: "r1",
        nodeId: "llm",
        pass: 1,
        requestId: "req-1",
        at: new Date(1_000).toISOString(),
      },
    ])
  })

  it("answer after settle is ignored", async () => {
    const gate = createPermissionAskGate({
      clock: createFakeClock(0),
      onRequested: async () => {},
      onAutoReject: async () => {},
    })
    const done = gate.ask({
      runId: "r1",
      nodeId: "n",
      pass: 1,
      tool: "t",
      requestId: "1",
    })
    await Promise.resolve()
    expect(gate.answer("permission:r1:n:1:1", "allow-always")).toBe(true)
    await done
    expect(gate.answer("permission:r1:n:1:1", "reject-once")).toBe(false)
  })
})
