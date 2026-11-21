import { describe, expect, it } from "vitest"
import type { RunSummary } from "@workspace/shared"
import { groupRunsByItem, NO_ITEM_KEY } from "./group-runs-by-item"

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
  it("groups by itemKey and puts missing under No item last", () => {
    const groups = groupRunsByItem([
      run({ id: "r1", itemKey: "zeta" }),
      run({ id: "r2" }),
      run({ id: "r3", itemKey: "alpha" }),
      run({ id: "r4", itemKey: "alpha" }),
    ])
    expect(groups.map((g) => g.key)).toEqual(["alpha", "zeta", NO_ITEM_KEY])
    expect(groups[0]?.runs.map((r) => r.id)).toEqual(["r3", "r4"])
    expect(groups[2]?.runs.map((r) => r.id)).toEqual(["r2"])
  })
})
