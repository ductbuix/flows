import { describe, expect, it } from "vitest"
import { parse, runToEnd } from "./decide-harness.ts"
import { latestStep } from "./model.ts"
import { foldAllSteps } from "./fold-steps.ts"
import { nextActions } from "./walk.ts"
import type { EngineEvent } from "@workspace/contracts"

describe("decide+fold table: branches", () => {
  it.each([
    {
      name: "yes branch runs, no is skipped",
      branch: "yes",
      want: { yes: "done", no: "skipped", after: "skipped" },
    },
    {
      name: "no branch runs after",
      branch: "no",
      want: { yes: "skipped", no: "done", after: "done" },
    },
  ])("$name", ({ branch, want }) => {
    const graph = parse(
      [
        { id: "j", kind: "judge", cli: "claude" },
        { id: "yes", kind: "command", run: "true" },
        { id: "no", kind: "command", run: "true" },
        { id: "after", kind: "command", run: "true" },
      ],
      [
        { from: "t", to: "j" },
        { from: "j", to: "yes", branch: "yes" },
        { from: "j", to: "no", branch: "no" },
        { from: "no", to: "after" },
      ]
    )
    const state = runToEnd(graph, { branchOf: { j: branch } })
    expect(state.status).toBe("succeeded")
    expect(latestStep(state.steps, "yes")?.status).toBe(want.yes)
    expect(latestStep(state.steps, "no")?.status).toBe(want.no)
    expect(latestStep(state.steps, "after")?.status).toBe(want.after)
  })
})

describe("walk branches (ported table)", () => {
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

  it.each([
    {
      name: "chain",
      graph: { nodes: [T, n("a"), n("b")], edges: [e("t", "a"), e("a", "b")] },
      events: [done("t")],
      want: ["run a"],
    },
    {
      name: "fan-out",
      graph: {
        nodes: [T, n("a"), n("b")],
        edges: [e("t", "a"), e("t", "b")],
      },
      events: [done("t")],
      want: ["run a", "run b"],
    },
    {
      name: "branch yes",
      graph: {
        nodes: [T, n("j"), n("yes"), n("no")],
        edges: [e("t", "j"), e("j", "yes", "yes"), e("j", "no", "no")],
      },
      events: [done("t"), done("j", "yes")],
      want: ["run yes", "skip no"],
    },
  ])("$name", ({ graph, events, want }) => {
    const actions = nextActions(
      graph,
      { trigger: "t" },
      foldAllSteps(events)
    ).map((a) => `${a.type} ${a.nodeId}`)
    expect(actions).toEqual(want)
  })
})
