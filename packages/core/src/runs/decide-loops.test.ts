import { describe, expect, it } from "vitest"
import { findLoopEdges, loopWarnings } from "@workspace/contracts"
import { parse, runToEnd } from "./decide-harness.ts"
import type { EffectResult, RunEffect, RunState } from "./model.ts"

/** Judge answers "no" for the first `nos` asks, then "yes". */
function judgeNos(nos: Record<string, number>) {
  const asked: Record<string, number> = {}
  return (fx: RunEffect, state: RunState): EffectResult => {
    const node = state.graph.nodes.find((n) => n.id === fx.nodeId)
    if (node?.kind === "judge") {
      const n = asked[fx.nodeId] ?? 0
      asked[fx.nodeId] = n + 1
      const branch = n < (nos[fx.nodeId] ?? 0) ? "no" : "yes"
      return { ok: true, outputs: [], branch }
    }
    return { ok: true, outputs: [`out/${fx.nodeId}`] }
  }
}

const passes = (state: RunState, id: string) =>
  (state.steps.steps[id] ?? []).map((s) => `${s.pass}:${s.status}`)

describe("decide+fold table: loops (ported from engine walk-loops)", () => {
  it("a Judge loop runs again on No and ends on Yes", () => {
    const graph = parse(
      [
        { id: "a", kind: "command", run: "true" },
        { id: "j", kind: "judge", cli: "claude" },
        { id: "ok", kind: "command", run: "true" },
      ],
      [
        { from: "t", to: "a" },
        { from: "a", to: "j" },
        { from: "j", to: "a", branch: "no" },
        { from: "j", to: "ok", branch: "yes" },
      ]
    )
    const state = runToEnd(graph, { result: judgeNos({ j: 2 }) })
    expect(state.status).toBe("succeeded")
    expect(passes(state, "a")).toEqual(["1:done", "2:done", "3:done"])
    expect(passes(state, "j")).toEqual(["1:done", "2:done", "3:done"])
    expect(state.steps.steps.j!.map((s) => s.branch)).toEqual([
      "no",
      "no",
      "yes",
    ])
    expect(passes(state, "ok")).toEqual(["1:done"])
  })

  it("stops with loop_limit when the Judge never says Yes", () => {
    const graph = parse(
      [
        { id: "a", kind: "command", run: "true" },
        { id: "j", kind: "judge", cli: "claude" },
        { id: "ok", kind: "command", run: "true" },
      ],
      [
        { from: "t", to: "a" },
        { from: "a", to: "j" },
        { from: "j", to: "a", branch: "no" },
        { from: "j", to: "ok", branch: "yes" },
      ],
      { loopPasses: 2 }
    )
    const state = runToEnd(graph, { result: judgeNos({ j: 99 }) })
    expect(state.status).toBe("failed")
    expect(passes(state, "a")).toEqual(["1:done", "2:done", "3:failed"])
    expect(state.steps.steps.a![2]!.failReason).toBe("loop_limit")
    expect(passes(state, "j")).toEqual(["1:done", "2:done"])
  })

  it("nested loops: the inner loop runs again in each outer round", () => {
    const graph = parse(
      [
        { id: "a", kind: "command", run: "true" },
        { id: "b", kind: "command", run: "true" },
        { id: "inner", kind: "judge", cli: "claude" },
        { id: "outer", kind: "judge", cli: "claude" },
        { id: "end", kind: "command", run: "true" },
      ],
      [
        { from: "t", to: "a" },
        { from: "a", to: "b" },
        { from: "b", to: "inner" },
        { from: "inner", to: "b", branch: "no" },
        { from: "inner", to: "outer", branch: "yes" },
        { from: "outer", to: "a", branch: "no" },
        { from: "outer", to: "end", branch: "yes" },
      ]
    )
    const state = runToEnd(graph, {
      result: judgeNos({ inner: 1, outer: 1 }),
    })
    expect(state.status).toBe("succeeded")
    expect(state.steps.steps.a).toHaveLength(2)
    expect(state.steps.steps.b).toHaveLength(3)
    expect(state.steps.steps.inner!.map((s) => s.branch)).toEqual([
      "no",
      "yes",
      "yes",
    ])
    expect(state.steps.steps.outer!.map((s) => s.branch)).toEqual(["no", "yes"])
    expect(passes(state, "end")).toEqual(["1:done"])
  })

  it("a self loop on a Judge asks again until Yes", () => {
    const graph = parse(
      [
        { id: "j", kind: "judge", cli: "claude" },
        { id: "ok", kind: "command", run: "true" },
      ],
      [
        { from: "t", to: "j" },
        { from: "j", to: "j", branch: "no" },
        { from: "j", to: "ok", branch: "yes" },
      ]
    )
    const state = runToEnd(graph, { result: judgeNos({ j: 2 }) })
    expect(state.status).toBe("succeeded")
    expect(state.steps.steps.j!.map((s) => s.branch)).toEqual([
      "no",
      "no",
      "yes",
    ])
    expect(passes(state, "ok")).toEqual(["1:done"])
  })
})

describe("findLoopEdges / loopWarnings (unchanged contracts)", () => {
  const nodes = ["t", "a", "b", "c"].map((id) => ({ id, kind: "command" }))
  const e = (from: string, to: string) => ({ from, to })

  it("marks self edges and the edges into each cycle's entry", () => {
    const edges = [
      e("t", "a"),
      e("a", "b"),
      e("b", "c"),
      e("c", "b"),
      e("c", "a"),
      e("c", "c"),
    ]
    expect([...findLoopEdges(nodes, edges)].sort()).toEqual([3, 4, 5])
  })

  it("warns on a cycle with no Judge, not on one with a Judge", () => {
    const plain = [
      { id: "t", kind: "trigger" },
      { id: "a", kind: "agent" },
      { id: "b", kind: "agent" },
    ]
    const warns = loopWarnings(plain, [
      { from: "t", to: "a" },
      { from: "a", to: "b" },
      { from: "b", to: "a" },
    ])
    expect(warns).toHaveLength(1)
    expect(warns[0]!.message).toMatch(/no Judge/)
    const withJudge = [plain[0]!, plain[1]!, { id: "j", kind: "judge" }]
    expect(
      loopWarnings(withJudge, [
        { from: "t", to: "a" },
        { from: "a", to: "j" },
        { from: "j", to: "a", branch: "no" },
      ])
    ).toEqual([])
  })
})
