import type { Workflow } from "@workspace/contracts"
import { effectForRun } from "./decide-effects.ts"
import { isOpenStep, type DecideOutput, type RunState } from "./model.ts"
import { nextActions } from "./walk.ts"

/** Take the first walk action or end the run. */
export function scheduleNext(state: RunState, at: string): DecideOutput {
  const graph = state.graph as Workflow
  const actions = nextActions(
    graph,
    {
      trigger: state.only ?? state.trigger ?? "",
      only: state.only,
      loopPasses: graph.limits?.loopPasses,
    },
    state.steps
  )

  if (actions.length === 0) {
    const open = Object.values(state.steps.steps).flat().some(isOpenStep)
    if (open) return { events: [], effects: [] }
    const failed = Object.values(state.steps.steps)
      .flat()
      .some((s) => s.status === "failed")
    return {
      events: [
        {
          type: failed ? "run_failed" : "run_succeeded",
          runId: state.runId,
          at,
        },
      ],
      effects: [],
    }
  }

  const a = actions[0]!
  if (a.type === "fail") {
    return {
      events: [
        {
          type: "step_started",
          runId: state.runId,
          at,
          nodeId: a.nodeId,
          pass: a.pass,
        },
        {
          type: "step_failed",
          runId: state.runId,
          at,
          nodeId: a.nodeId,
          pass: a.pass,
          reason: a.reason,
        },
      ],
      effects: [],
    }
  }
  if (a.type === "skip") {
    return {
      events: [
        {
          type: "step_skipped",
          runId: state.runId,
          at,
          nodeId: a.nodeId,
          pass: a.pass,
        },
      ],
      effects: [],
    }
  }

  const effect = effectForRun(state, a.nodeId, a.pass, a.inputs, 1)
  return {
    events: [
      {
        type: "step_started",
        runId: state.runId,
        at,
        nodeId: a.nodeId,
        pass: a.pass,
      },
    ],
    effects: [effect],
  }
}
