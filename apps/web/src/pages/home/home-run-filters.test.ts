import { describe, expect, it } from "vitest"
import type { RunSummary } from "@workspace/shared"
import {
  collectNeedsYou,
  collectRecent,
  collectRunning,
} from "./home-run-filters"

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

describe("home-run-filters", () => {
  it("collects needsYou entries with run context", () => {
    const runs = [
      summary({
        id: "r1",
        needsYou: [{ taskId: "hold" }],
      }),
      summary({ id: "r2", needsYou: [] }),
    ]
    expect(collectNeedsYou(runs)).toEqual([{ run: runs[0], taskId: "hold" }])
  })

  it("splits running and recent finished", () => {
    const runs = [
      summary({ id: "live", status: "running" }),
      summary({ id: "queued", status: "queued" }),
      summary({
        id: "old",
        status: "succeeded",
        finishedAt: "2026-01-01T01:00:00.000Z",
      }),
      summary({
        id: "new",
        status: "failed",
        finishedAt: "2026-01-01T02:00:00.000Z",
      }),
      summary({
        id: "mid",
        status: "cancelled",
        finishedAt: "2026-01-01T01:30:00.000Z",
      }),
    ]
    expect(collectRunning(runs).map((r) => r.id)).toEqual(["live", "queued"])
    expect(collectRecent(runs, 2).map((r) => r.id)).toEqual(["new", "mid"])
  })
})
