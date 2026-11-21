import { describe, expect, it } from "vitest"
import type { RunSummary } from "@workspace/shared"
import { AD_HOC_LABEL, groupRunsByItem } from "./group-runs-by-item"

function run(
  partial: Partial<RunSummary> & Pick<RunSummary, "id">
): RunSummary {
  return {
    workflowId: "wf",
    workflowName: "wf",
    status: "succeeded",
    needsYou: [],
    taskCounts: { done: 1, total: 1 },
    startedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  }
}

describe("groupRunsByItem", () => {
  it("groups by work item title and puts Ad hoc last", () => {
    const titles = {
      "wi-z": "Zeta story",
      "wi-a": "Alpha story",
    }
    const groups = groupRunsByItem(
      [
        run({ id: "r1", workItemId: "wi-z" }),
        run({ id: "r2" }),
        run({ id: "r3", workItemId: "wi-a" }),
        run({ id: "r4", workItemId: "wi-a" }),
        run({ id: "r5", workItemId: "missing" }),
      ],
      titles
    )
    expect(groups.map((g) => g.label)).toEqual([
      "Alpha story",
      "missing",
      "Zeta story",
      AD_HOC_LABEL,
    ])
    expect(groups[0]?.runs.map((r) => r.id)).toEqual(["r3", "r4"])
    expect(groups[3]?.runs.map((r) => r.id)).toEqual(["r2"])
  })
})
