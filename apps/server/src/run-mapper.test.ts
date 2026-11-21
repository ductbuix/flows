import { describe, expect, it } from "vitest"
import type { RunState } from "@workspace/engine"
import { toTaskViews } from "./run-mapper.ts"

describe("toTaskViews model fields", () => {
  it("passes model, effort, and modelSource onto AttemptView", () => {
    const state = {
      runId: "r1",
      workflowId: "w1",
      status: "running",
      sandboxed: true,
      graph: {
        id: "w1",
        tasks: [{ id: "a", kind: "agent", cli: "claude", needs: [] }],
      },
      tasks: {
        a: {
          id: "a",
          status: "running",
          attempts: [
            {
              attempt: 1,
              pid: 42,
              model: "haiku",
              effort: "low",
              modelSource: "task",
            },
          ],
        },
      },
    } as unknown as RunState

    const views = toTaskViews(state)
    expect(views[0]?.attempts[0]).toMatchObject({
      attempt: 1,
      model: "haiku",
      effort: "low",
      modelSource: "task",
    })
  })
})
