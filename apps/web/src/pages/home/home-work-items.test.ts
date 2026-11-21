import { describe, expect, it } from "vitest"
import type { RunSummary, WorkItemSummary } from "@workspace/shared"
import { collectHomeWorkItems } from "./home-work-items"

function summary(
  partial: Partial<RunSummary> & Pick<RunSummary, "id">
): RunSummary {
  return {
    workflowId: "wf",
    workflowName: "wf",
    status: "running",
    needsYou: [],
    taskCounts: { done: 0, total: 1 },
    startedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  }
}

function item(
  partial: Partial<WorkItemSummary> & Pick<WorkItemSummary, "id" | "title">
): WorkItemSummary {
  return {
    source: { kind: "adhoc" },
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  }
}

describe("collectHomeWorkItems", () => {
  it("keeps items with live or finished runs, newest first", () => {
    const items = [
      item({ id: "a", title: "Alpha" }),
      item({ id: "b", title: "Beta" }),
      item({ id: "c", title: "Cold" }),
    ]
    const runs = [
      summary({
        id: "r-old",
        workItemId: "a",
        status: "succeeded",
        finishedAt: "2026-01-01T01:00:00.000Z",
      }),
      summary({
        id: "r-new",
        workItemId: "b",
        status: "running",
        startedAt: "2026-01-01T03:00:00.000Z",
      }),
      summary({
        id: "r-a2",
        workItemId: "a",
        status: "failed",
        finishedAt: "2026-01-01T02:00:00.000Z",
      }),
      summary({ id: "orphan", workItemId: "gone", status: "succeeded" }),
      summary({ id: "adhoc", status: "succeeded" }),
    ]
    const result = collectHomeWorkItems(runs, items)
    expect(result.map((row) => row.item.id)).toEqual(["b", "a"])
    expect(result[1]?.run.id).toBe("r-a2")
  })
})
