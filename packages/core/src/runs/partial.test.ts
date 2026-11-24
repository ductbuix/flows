import { describe, expect, it } from "vitest"
import { workflowSchema } from "@workspace/contracts"
import { foldAllSteps } from "./fold.ts"
import {
  assertPartialReady,
  partialRefusal,
  planPartialSeed,
  type PartialBase,
} from "./partial.ts"
import { at, parse } from "./decide-harness.ts"

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

function baseFromEvents(
  runId: string,
  events: Parameters<typeof foldAllSteps>[0],
  stepRun = false
): PartialBase {
  return {
    runId,
    graph,
    steps: foldAllSteps(events),
    stepRun,
  }
}

describe("partial planning (ported from engine partial-runs)", () => {
  it("refuses unknown node and only+from together", () => {
    expect(partialRefusal(graph, { only: "nope" })).toMatch(/Unknown node/)
    expect(partialRefusal(graph, { only: "o", from: "p" })).toMatch(
      /only or from/
    )
  })

  it("only=o seeds upstream done steps as reused", () => {
    const base = baseFromEvents("r1", [
      {
        type: "step_done",
        runId: "r1",
        at,
        nodeId: "t",
        pass: 1,
        outputs: ["nodes/t/pass-1/text.md"],
      },
      {
        type: "step_done",
        runId: "r1",
        at,
        nodeId: "p",
        pass: 1,
        outputs: ["nodes/p/pass-1/text.md"],
      },
    ])
    const plan = planPartialSeed({
      runId: "r2",
      at,
      graph,
      partial: { only: "o", bases: ["r1"] },
      bases: [base],
      unchanged: () => true,
    })
    expect(plan.events.map((e) => e.type)).toEqual(["step_done", "step_done"])
    expect(plan.events.every((e) => "reused" in e && e.reused)).toBe(true)
    expect(plan.copies.map((c) => c.nodeId).sort()).toEqual(["p", "t"])
  })

  it("only refuses when an input has no result", () => {
    expect(() =>
      assertPartialReady({
        graph,
        partial: { only: "o", bases: [] },
        bases: [],
      })
    ).toThrow(/Run t first/)
  })

  it("from reuses unchanged nodes outside the downstream set", () => {
    const base = baseFromEvents("r1", [
      {
        type: "step_done",
        runId: "r1",
        at,
        nodeId: "t",
        pass: 1,
        outputs: [],
      },
      {
        type: "step_done",
        runId: "r1",
        at,
        nodeId: "p",
        pass: 1,
        outputs: [],
      },
      {
        type: "step_done",
        runId: "r1",
        at,
        nodeId: "o",
        pass: 1,
        outputs: [],
      },
    ])
    const plan = planPartialSeed({
      runId: "r2",
      at,
      graph,
      partial: { from: "o", bases: ["r1"] },
      bases: [base],
      unchanged: () => true,
    })
    expect(plan.copies.map((c) => c.nodeId).sort()).toEqual(["p", "t"])
  })

  it("from skips a step-run base", () => {
    const stepRun = baseFromEvents(
      "r2",
      [
        {
          type: "step_done",
          runId: "r2",
          at,
          nodeId: "t",
          pass: 1,
          outputs: [],
          reused: true,
        },
      ],
      true
    )
    const full = baseFromEvents("r1", [
      {
        type: "step_done",
        runId: "r1",
        at,
        nodeId: "t",
        pass: 1,
        outputs: [],
      },
      {
        type: "step_done",
        runId: "r1",
        at,
        nodeId: "p",
        pass: 1,
        outputs: [],
      },
    ])
    const plan = planPartialSeed({
      runId: "r3",
      at,
      graph,
      partial: { from: "o", bases: ["r2", "r1"] },
      bases: [stepRun, full],
      unchanged: () => true,
    })
    expect(plan.copies.map((c) => c.nodeId).sort()).toEqual(["p", "t"])
  })

  it("from runs everything when shell changed", () => {
    const base = baseFromEvents("r1", [
      {
        type: "step_done",
        runId: "r1",
        at,
        nodeId: "t",
        pass: 1,
        outputs: [],
      },
    ])
    const changed = workflowSchema.parse({
      ...graph,
      limits: { loopPasses: 2 },
    })
    const plan = planPartialSeed({
      runId: "r2",
      at,
      graph: changed,
      partial: { from: "o", bases: ["r1"] },
      bases: [base],
      unchanged: () => true,
    })
    expect(plan.events).toEqual([])
  })
})
