import { describe, expect, it } from "vitest"
import type { EngineEvent } from "@workspace/shared"
import { foldSteps } from "./fold-steps.ts"
import { nextActions, type WalkGraph } from "./walk.ts"

const T = { id: "t", kind: "trigger" }
const n = (id: string) => ({ id, kind: "command" })
const e = (from: string, to: string, branch?: string) => ({
  from,
  to,
  ...(branch ? { branch } : {}),
})
const done = (nodeId: string, branch?: string) =>
  ({
    type: "step_done",
    runId: "r",
    at: "t",
    nodeId,
    pass: 1,
    branch,
  }) as unknown as EngineEvent
const failed = (nodeId: string) =>
  ({
    type: "step_failed",
    runId: "r",
    at: "t",
    nodeId,
    pass: 1,
    reason: "exit",
  }) as unknown as EngineEvent
const started = (nodeId: string) =>
  ({
    type: "step_started",
    runId: "r",
    at: "t",
    nodeId,
    pass: 1,
  }) as unknown as EngineEvent

function walk(graph: WalkGraph, events: EngineEvent[] = [], trigger = "t") {
  return nextActions(graph, { trigger }, foldSteps(events)).map((a) =>
    a.type === "run"
      ? `run ${a.nodeId}<${a.inputs.join(",")}>`
      : `skip ${a.nodeId}`
  )
}

describe("nextActions", () => {
  it("chain: starts at the trigger, then one step at a time", () => {
    const g = { nodes: [T, n("a"), n("b")], edges: [e("t", "a"), e("a", "b")] }
    expect(walk(g)).toEqual(["run t<>"])
    expect(walk(g, [started("t")])).toEqual([])
    expect(walk(g, [done("t")])).toEqual(["run a<t>"])
    expect(walk(g, [done("t"), done("a")])).toEqual(["run b<a>"])
    expect(walk(g, [done("t"), done("a"), done("b")])).toEqual([])
  })

  it("fan-out: both children are due together", () => {
    const g = {
      nodes: [T, n("a"), n("b")],
      edges: [e("t", "a"), e("t", "b")],
    }
    expect(walk(g, [done("t")])).toEqual(["run a<t>", "run b<t>"])
  })

  it("join waits for every forward input", () => {
    const g = {
      nodes: [T, n("a"), n("b"), n("j")],
      edges: [e("t", "a"), e("t", "b"), e("a", "j"), e("b", "j")],
    }
    expect(walk(g, [done("t"), done("a")])).toEqual(["run b<t>"])
    expect(walk(g, [done("t"), done("a"), started("b")])).toEqual([])
    expect(walk(g, [done("t"), done("a"), done("b")])).toEqual(["run j<a,b>"])
  })

  it("skip chain: no active input skips and the skip flows on", () => {
    const g = {
      nodes: [T, n("a"), n("b"), n("c")],
      edges: [e("t", "a"), e("a", "b"), e("b", "c")],
    }
    expect(walk(g, [done("t"), failed("a")])).toEqual(["skip b", "skip c"])
  })

  it("branch taken runs its side, branch missed skips the other", () => {
    const g = {
      nodes: [T, n("j"), n("yes"), n("no"), n("after")],
      edges: [
        e("t", "j"),
        e("j", "yes", "yes"),
        e("j", "no", "no"),
        e("no", "after"),
      ],
    }
    expect(walk(g, [done("t"), done("j", "yes")])).toEqual([
      "run yes<j>",
      "skip no",
      "skip after",
    ])
  })

  it("join keeps the active inputs only", () => {
    const g = {
      nodes: [T, n("j"), n("yes"), n("no"), n("m")],
      edges: [
        e("t", "j"),
        e("j", "yes", "yes"),
        e("j", "no", "no"),
        e("yes", "m"),
        e("no", "m"),
      ],
    }
    const events = [done("t"), done("j", "no"), done("no")]
    expect(walk(g, [...events, { ...started("yes") }])).toEqual([])
    expect(
      nextActions(
        g,
        { trigger: "t" },
        foldSteps([
          ...events,
          {
            type: "step_skipped",
            runId: "r",
            at: "t",
            nodeId: "yes",
            pass: 1,
          } as unknown as EngineEvent,
        ])
      ).map((a) => a.type + " " + a.nodeId)
    ).toEqual(["run m"])
  })

  it("several triggers: only the started one runs, others stay inert", () => {
    const g = {
      nodes: [T, { id: "t2", kind: "trigger" }, n("a")],
      edges: [e("t", "a"), e("t2", "a")],
    }
    expect(walk(g)).toEqual(["run t<>"])
    expect(walk(g, [done("t")])).toEqual(["run a<t>"])
    expect(walk(g, [], "t2")).toEqual(["run t2<>"])
  })

  it("prompt nodes start with the run", () => {
    const g = {
      nodes: [T, { id: "p", kind: "prompt" }, n("a")],
      edges: [e("t", "a"), e("p", "a")],
    }
    expect(walk(g)).toEqual(["run t<>", "run p<>"])
    expect(walk(g, [done("t"), started("p")])).toEqual([])
    expect(walk(g, [done("t"), done("p")])).toEqual(["run a<t,p>"])
  })

  it("a cycle is no longer an error: its back edge is a loop edge", () => {
    const g = {
      nodes: [T, n("a"), n("b")],
      edges: [e("t", "a"), e("a", "b"), e("b", "a")],
    }
    expect(walk(g)).toEqual(["run t<>"])
    expect(walk(g, [done("t")])).toEqual(["run a<t>"])
    expect(() =>
      walk({ nodes: [T, n("a")], edges: [e("a", "a")] })
    ).not.toThrow()
  })
})
