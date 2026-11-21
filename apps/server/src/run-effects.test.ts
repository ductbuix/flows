import { describe, expect, it } from "vitest"
import type { EngineEvent } from "@workspace/shared"
import { effectsFromEvents } from "./run-effects.ts"

describe("effectsFromEvents", () => {
  it("maps pull, local and applied publish events", () => {
    const events: EngineEvent[] = [
      {
        type: "library_pulled",
        runId: "r1",
        at: "t1",
        connection: "demo",
        kind: "item",
        entityId: "v1",
        revision: "1",
        impact: "read",
      },
      {
        type: "work_copy_changed",
        runId: "r1",
        at: "t2",
        connection: "demo",
        impact: "local",
        opCount: 2,
        destructive: false,
      },
      {
        type: "publish_finished",
        runId: "r1",
        at: "t3",
        taskId: "ship",
        connection: "demo",
        status: "applied",
        result: { url: "https://example.test/pr/1" },
        undoNote: "Close the PR",
        impact: "cloud",
      },
      {
        type: "publish_finished",
        runId: "r1",
        at: "t4",
        taskId: "ship2",
        connection: "demo",
        status: "conflict",
        message: "nope",
      },
    ]
    expect(effectsFromEvents(events)).toEqual([
      {
        what: "Pulled item/v1@1",
        connection: "demo",
        impact: "read",
      },
      {
        what: "Unpublished local changes (2 ops)",
        connection: "demo",
        impact: "local",
      },
      {
        what: "Published via ship",
        connection: "demo",
        impact: "cloud",
        result: "https://example.test/pr/1",
        undoNote: "Close the PR",
      },
    ])
  })
})
