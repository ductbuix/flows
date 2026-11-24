import { describe, expect, it } from "vitest"
import { createScheduler } from "./scheduler.ts"

describe("scheduler policy (steps)", () => {
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
      name: "queued steps start in order",
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
        { after: 3, grants: [{ runId: "r1", stepId: "s" }] },
        { after: 4, grants: [{ runId: "r2", stepId: "s" }] },
      ],
    },
    {
      name: "cancel frees a step slot",
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

describe("scheduler policy (per-workflow run queues)", () => {
  it.each([
    {
      name: "per-workflow cap queues extra runs",
      maxConcurrentRuns: 1,
      steps: [
        {
          op: "admit" as const,
          runId: "r1",
          workflowId: "wf",
          at: "2026-11-24T00:00:01.000Z",
        },
        {
          op: "admit" as const,
          runId: "r2",
          workflowId: "wf",
          at: "2026-11-24T00:00:02.000Z",
        },
        {
          op: "admit" as const,
          runId: "r3",
          workflowId: "wf",
          at: "2026-11-24T00:00:03.000Z",
        },
      ],
      wantActive: [
        {
          runId: "r1",
          workflowId: "wf",
          at: "2026-11-24T00:00:01.000Z",
        },
      ],
      wantQueued: [
        {
          runId: "r2",
          workflowId: "wf",
          at: "2026-11-24T00:00:02.000Z",
        },
        {
          runId: "r3",
          workflowId: "wf",
          at: "2026-11-24T00:00:03.000Z",
        },
      ],
    },
    {
      name: "FIFO activation on release",
      maxConcurrentRuns: 1,
      steps: [
        {
          op: "admit" as const,
          runId: "r1",
          workflowId: "wf",
          at: "2026-11-24T00:00:01.000Z",
        },
        {
          op: "admit" as const,
          runId: "r2",
          workflowId: "wf",
          at: "2026-11-24T00:00:02.000Z",
        },
        {
          op: "admit" as const,
          runId: "r3",
          workflowId: "wf",
          at: "2026-11-24T00:00:03.000Z",
        },
        { op: "endRun" as const, runId: "r1" },
        { op: "endRun" as const, runId: "r2" },
      ],
      wantActive: [
        {
          runId: "r3",
          workflowId: "wf",
          at: "2026-11-24T00:00:03.000Z",
        },
      ],
      wantQueued: [],
      wantAfter: [
        {
          after: 4,
          active: [
            {
              runId: "r2",
              workflowId: "wf",
              at: "2026-11-24T00:00:02.000Z",
            },
          ],
          queued: [
            {
              runId: "r3",
              workflowId: "wf",
              at: "2026-11-24T00:00:03.000Z",
            },
          ],
        },
      ],
    },
    {
      name: "cancel of queued run frees nothing",
      maxConcurrentRuns: 1,
      steps: [
        {
          op: "admit" as const,
          runId: "r1",
          workflowId: "wf",
          at: "2026-11-24T00:00:01.000Z",
        },
        {
          op: "admit" as const,
          runId: "r2",
          workflowId: "wf",
          at: "2026-11-24T00:00:02.000Z",
        },
        {
          op: "admit" as const,
          runId: "r3",
          workflowId: "wf",
          at: "2026-11-24T00:00:03.000Z",
        },
        { op: "cancel" as const, runId: "r2" },
      ],
      wantActive: [
        {
          runId: "r1",
          workflowId: "wf",
          at: "2026-11-24T00:00:01.000Z",
        },
      ],
      wantQueued: [
        {
          runId: "r3",
          workflowId: "wf",
          at: "2026-11-24T00:00:03.000Z",
        },
      ],
    },
    {
      name: "two workflows independent",
      maxConcurrentRuns: 1,
      steps: [
        {
          op: "admit" as const,
          runId: "a1",
          workflowId: "wfA",
          at: "2026-11-24T00:00:01.000Z",
        },
        {
          op: "admit" as const,
          runId: "b1",
          workflowId: "wfB",
          at: "2026-11-24T00:00:01.000Z",
        },
        {
          op: "admit" as const,
          runId: "a2",
          workflowId: "wfA",
          at: "2026-11-24T00:00:02.000Z",
        },
        {
          op: "admit" as const,
          runId: "b2",
          workflowId: "wfB",
          at: "2026-11-24T00:00:02.000Z",
        },
      ],
      wantActive: [
        {
          runId: "a1",
          workflowId: "wfA",
          at: "2026-11-24T00:00:01.000Z",
        },
        {
          runId: "b1",
          workflowId: "wfB",
          at: "2026-11-24T00:00:01.000Z",
        },
      ],
      wantQueued: [
        {
          runId: "a2",
          workflowId: "wfA",
          at: "2026-11-24T00:00:02.000Z",
        },
        {
          runId: "b2",
          workflowId: "wfB",
          at: "2026-11-24T00:00:02.000Z",
        },
      ],
    },
  ])(
    "$name",
    ({ maxConcurrentRuns, steps, wantActive, wantQueued, wantAfter }) => {
      const sched = createScheduler({
        maxConcurrent: 8,
        maxConcurrentRuns,
      })
      const checkpoints = wantAfter ?? []
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i]!
        if (s.op === "admit") {
          sched.admit(s.runId, s.workflowId, s.at)
        } else if (s.op === "endRun") {
          sched.endRun(s.runId)
        } else {
          sched.cancel(s.runId)
        }
        const cp = checkpoints.find((c) => c.after === i + 1)
        if (cp) {
          expect(sched.activeRuns()).toEqual(cp.active)
          expect(sched.queuedRuns()).toEqual(cp.queued)
        }
      }
      expect(sched.activeRuns()).toEqual(wantActive)
      expect(sched.queuedRuns()).toEqual(wantQueued)
    }
  )

  it("FIFO uses run_started.at, not admit order", () => {
    const sched = createScheduler({
      maxConcurrent: 8,
      maxConcurrentRuns: 1,
    })
    expect(sched.admit("late", "wf", "2026-11-24T00:00:02.000Z")).toBe(
      "running"
    )
    expect(sched.admit("early", "wf", "2026-11-24T00:00:01.000Z")).toBe(
      "queued"
    )
    expect(sched.admit("mid", "wf", "2026-11-24T00:00:01.500Z")).toBe("queued")
    sched.endRun("late")
    expect(sched.activeRuns()).toEqual([
      {
        runId: "early",
        workflowId: "wf",
        at: "2026-11-24T00:00:01.000Z",
      },
    ])
    expect(sched.queuedRuns()).toEqual([
      {
        runId: "mid",
        workflowId: "wf",
        at: "2026-11-24T00:00:01.500Z",
      },
    ])
  })

  it("after replay, free slots activate queued runs in at order", () => {
    const sched = createScheduler({
      maxConcurrent: 8,
      maxConcurrentRuns: 2,
    })
    // Replay: one running, two queued (older first).
    expect(sched.admit("r1", "wf", "2026-11-24T00:00:01.000Z")).toBe("running")
    expect(sched.admit("r2", "wf", "2026-11-24T00:00:02.000Z")).toBe("running")
    expect(sched.admit("r3", "wf", "2026-11-24T00:00:03.000Z")).toBe("queued")
    sched.endRun("r1")
    expect(
      sched
        .activeRuns()
        .map((r) => r.runId)
        .sort()
    ).toEqual(["r2", "r3"])
    expect(sched.queuedRuns()).toEqual([])
  })
})
