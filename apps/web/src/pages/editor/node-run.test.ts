import type { RunDetail } from "@workspace/shared"
import { describe, expect, it } from "vitest"
import { formatElapsed, hasTrigger, nodeStatus, trackTimes } from "./node-run"

const run = (...tasks: [string, string][]) =>
  ({
    tasks: tasks.map(([id, status]) => ({ id, status, attempts: [] })),
  }) as unknown as RunDetail

describe("node run view", () => {
  it("maps task status onto node status", () => {
    expect(nodeStatus("pending")).toBeUndefined()
    expect(nodeStatus("succeeded")).toBe("done")
    expect(nodeStatus("awaiting_approval")).toBe("waiting")
  })

  it("formats elapsed time", () => {
    expect(formatElapsed(850)).toBe("850ms")
    expect(formatElapsed(3200)).toBe("3.2s")
    expect(formatElapsed(65_000)).toBe("1m 05s")
  })

  it("needs a trigger to run", () => {
    expect(hasTrigger([{ kind: "command" }])).toBe(false)
    expect(hasTrigger([{ kind: "trigger" }])).toBe(true)
  })

  it("times a step from running to done, and again after a retry", () => {
    let t = trackTimes({}, run(["c", "running"]), 100)
    expect(t.c).toEqual({ start: 100 })
    t = trackTimes(t, run(["c", "failed"]), 250)
    expect(t.c).toEqual({ start: 100, end: 250 })
    t = trackTimes(t, run(["c", "running"]), 400)
    expect(t.c).toEqual({ start: 400 })
  })
})
