import type { RunSummary } from "@workspace/contracts"
import { describe, expect, it } from "vitest"
import { pageRunSummaries } from "./fcp-run-read.ts"

function summary(id: string): RunSummary {
  return {
    id,
    workflowId: "wf",
    workflowName: "wf",
    status: "succeeded",
    needsYou: [],
    taskCounts: { done: 1, total: 1 },
    startedAt: "2026-01-01T00:00:00.000Z",
  }
}

describe("pageRunSummaries", () => {
  const items = [summary("r3"), summary("r2"), summary("r1")]

  it("returns the first page and a next cursor", () => {
    expect(pageRunSummaries(items, undefined, 2)).toEqual({
      items: [items[0], items[1]],
      next: "r2",
    })
  })

  it("continues after the cursor", () => {
    expect(pageRunSummaries(items, "r2", 2)).toEqual({
      items: [items[2]],
    })
  })

  it("starts from the beginning when the cursor is unknown", () => {
    expect(pageRunSummaries(items, "missing", 1)).toEqual({
      items: [items[0]],
      next: "r3",
    })
  })
})
