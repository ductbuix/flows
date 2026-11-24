import { describe, expect, it } from "vitest"
import { createScheduler } from "./scheduler.ts"

describe("scheduler policy", () => {
  it.each([
    {
      name: "global limit",
      maxConcurrent: 2,
      steps: [
        { op: "request" as const, runId: "r1", stepId: "a" },
        { op: "request" as const, runId: "r1", stepId: "b" },
        { op: "request" as const, runId: "r2", stepId: "c" },
      ],
      wantGrants: [
        { runId: "r1", stepId: "a" },
        { runId: "r1", stepId: "b" },
      ],
    },
    {
      name: "queued runs start in order",
      maxConcurrent: 1,
      steps: [
        { op: "request" as const, runId: "r1", stepId: "s" },
        { op: "request" as const, runId: "r2", stepId: "s" },
        { op: "request" as const, runId: "r3", stepId: "s" },
        { op: "release" as const, runId: "r1", stepId: "s" },
        { op: "release" as const, runId: "r2", stepId: "s" },
      ],
      wantGrants: [{ runId: "r3", stepId: "s" }],
      wantAfter: [
        {
          after: 3,
          grants: [{ runId: "r1", stepId: "s" }],
        },
        {
          after: 4,
          grants: [{ runId: "r2", stepId: "s" }],
        },
      ],
    },
    {
      name: "cancel frees a slot",
      maxConcurrent: 1,
      steps: [
        { op: "request" as const, runId: "r1", stepId: "a" },
        { op: "request" as const, runId: "r2", stepId: "b" },
        { op: "cancel" as const, runId: "r1" },
      ],
      wantGrants: [{ runId: "r2", stepId: "b" }],
    },
  ])("$name", ({ maxConcurrent, steps, wantGrants, wantAfter }) => {
    const sched = createScheduler({ maxConcurrent })
    const checkpoints = wantAfter ?? []
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i]!
      if (s.op === "request") sched.request(s.runId, s.stepId)
      else if (s.op === "release") sched.release(s.runId, s.stepId)
      else sched.cancel(s.runId)

      const cp = checkpoints.find((c) => c.after === i + 1)
      if (cp) expect(sched.grants()).toEqual(cp.grants)
    }
    expect(sched.grants()).toEqual(wantGrants)
  })

  it("request is idempotent for the same runId+stepId", () => {
    const sched = createScheduler({ maxConcurrent: 1 })
    sched.request("r1", "a")
    sched.request("r1", "a")
    expect(sched.grants()).toEqual([{ runId: "r1", stepId: "a" }])
    sched.request("r2", "a")
    sched.request("r2", "a")
    sched.release("r1", "a")
    expect(sched.grants()).toEqual([{ runId: "r2", stepId: "a" }])
  })
})
