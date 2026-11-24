import { describe, expect, it } from "vitest"
import { decide } from "./decide.ts"
import { fold } from "./fold.ts"
import { at, parse, runToEnd } from "./decide-harness.ts"
import { latestStep, type RunState } from "./model.ts"

describe("decide+fold table: loops with limit", () => {
  it.each([
    {
      name: "self loop hits loop_limit at pass 6 by default",
      limits: undefined as { loopPasses: number } | undefined,
      wantPasses: 6,
      wantFailPass: 6,
    },
    {
      name: "custom loopPasses=2 fails on pass 3",
      limits: { loopPasses: 2 },
      wantPasses: 3,
      wantFailPass: 3,
    },
  ])("$name", ({ limits, wantPasses, wantFailPass }) => {
    const graph = parse(
      [{ id: "s", kind: "command", run: "true" }],
      [
        { from: "t", to: "s" },
        { from: "s", to: "s" },
      ],
      limits
    )
    const state = runToEnd(graph)
    expect(state.status).toBe("failed")
    expect(state.steps.steps.s).toHaveLength(wantPasses)
    expect(latestStep(state.steps, "s")).toMatchObject({
      pass: wantFailPass,
      status: "failed",
      failReason: "loop_limit",
    })
  })
})

describe("decide+fold table: retry", () => {
  it.each([
    {
      name: "retries until success within max",
      max: 3,
      fails: 2,
      wantStatus: "succeeded" as const,
      wantAttempts: 3,
    },
    {
      name: "fails when retries exhausted",
      max: 2,
      fails: 2,
      wantStatus: "failed" as const,
      wantAttempts: 2,
    },
  ])("$name", ({ max, fails, wantStatus, wantAttempts }) => {
    const graph = parse(
      [{ id: "work", kind: "command", run: "false", retry: { max } }],
      [{ from: "t", to: "work" }]
    )
    let failCount = 0
    const state = runToEnd(graph, {
      result: (fx) => {
        if (fx.kind !== "launch_step" || fx.nodeId !== "work") {
          return { ok: true, outputs: [] }
        }
        if (failCount < fails) {
          failCount++
          return {
            ok: false,
            reason: "exit",
            attempt: { attempt: fx.attempt, exitCode: 1, endedAt: at },
          }
        }
        return { ok: true, outputs: ["out/work"] }
      },
    })
    expect(state.status).toBe(wantStatus)
    expect(latestStep(state.steps, "work")?.attempts).toBe(wantAttempts)
  })

  it("waits for backoff before retrying (time from input)", () => {
    const graph = parse(
      [{ id: "work", kind: "command", run: "false", retry: { max: 2 } }],
      [{ from: "t", to: "work" }]
    )
    const start = decide(null, { kind: "start", at, runId: "r1", graph })
    let state: RunState | null = null
    for (const e of start.events) state = fold(state, e)

    let out = decide(state, { kind: "wake", at })
    for (const e of out.events) state = fold(state, e)!
    for (const fx of out.effects) {
      const r = decide(state, {
        kind: "effect_result",
        at,
        nodeId: fx.nodeId,
        pass: fx.pass,
        result: { ok: true, outputs: [] },
      })
      for (const e of r.events) state = fold(state, e)!
    }

    out = decide(state, { kind: "wake", at })
    for (const e of out.events) state = fold(state, e)!
    expect(out.effects[0]).toMatchObject({
      kind: "launch_step",
      nodeId: "work",
      attempt: 1,
    })
    state = fold(state, {
      type: "attempt_started",
      runId: "r1",
      at,
      taskId: "work",
      nodeId: "work",
      pass: 1,
      attempt: 1,
    })!
    state = fold(state, {
      type: "attempt_finished",
      runId: "r1",
      at,
      taskId: "work",
      nodeId: "work",
      pass: 1,
      attempt: 1,
      exitCode: 1,
    })!

    out = decide(state, { kind: "wake", at, retryBackoffMs: 2000 })
    expect(out.events).toEqual([])
    expect(out.effects).toEqual([])

    const after = "2026-11-24T00:00:03.000Z"
    out = decide(state, { kind: "wake", at: after, retryBackoffMs: 2000 })
    expect(out.effects[0]).toMatchObject({
      kind: "launch_step",
      nodeId: "work",
      attempt: 2,
    })
  })
})
