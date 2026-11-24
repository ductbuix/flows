import { describe, expect, it } from "vitest"
import type { EngineEvent } from "@workspace/contracts"
import { decide } from "./decide.ts"
import { fold } from "./fold.ts"
import { at, parse, runToEnd } from "./decide-harness.ts"
import { latestStep, type RunState } from "./model.ts"

describe("decide+fold table: partial runs", () => {
  it.each([
    {
      name: "only=o runs output on seeded upstream",
      only: "o",
      seed: [
        {
          type: "step_done",
          runId: "r1",
          at,
          nodeId: "t",
          pass: 1,
          outputs: ["nodes/t/pass-1/text.md"],
          reused: true as const,
        },
        {
          type: "step_done",
          runId: "r1",
          at,
          nodeId: "p",
          pass: 1,
          outputs: ["nodes/p/pass-1/text.md"],
          reused: true as const,
        },
      ] as EngineEvent[],
      wantStarted: ["o"],
    },
  ])("$name", ({ only, seed, wantStarted }) => {
    const graph = parse(
      [
        { id: "p", kind: "prompt" },
        { id: "o", kind: "output", target: "folder" },
      ],
      [
        { from: "t", to: "o" },
        { from: "p", to: "o" },
      ]
    )
    const state = runToEnd(graph, { only, seed })
    expect(state.status).toBe("succeeded")
    expect(state.only).toBe("o")
    expect(latestStep(state.steps, "o")?.status).toBe("done")
    expect(latestStep(state.steps, "t")?.reused).toBe(true)
    expect(latestStep(state.steps, "p")?.reused).toBe(true)
    const started = Object.values(state.steps.steps)
      .flat()
      .filter((s) => !s.reused && s.status === "done")
      .map((s) => s.nodeId)
    expect(started).toEqual(wantStarted)
  })
})

describe("effects union", () => {
  it("emits write_output and notify for output targets", () => {
    const folder = parse(
      [{ id: "o", kind: "output", target: "folder" }],
      [{ from: "t", to: "o" }]
    )
    let state: RunState | null = null
    for (const e of decide(null, { kind: "start", at, runId: "r1", graph: folder })
      .events) {
      state = fold(state, e)
    }
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
    expect(out.effects[0]?.kind).toBe("write_output")

    const notify = parse(
      [{ id: "o", kind: "output", target: "notify", title: "Hi" }],
      [{ from: "t", to: "o" }]
    )
    state = null
    for (const e of decide(null, {
      kind: "start",
      at,
      runId: "r2",
      graph: notify,
    }).events) {
      state = fold(state, e)
    }
    out = decide(state, { kind: "wake", at })
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
    expect(out.effects[0]).toMatchObject({ kind: "notify", title: "Hi" })
  })
})
