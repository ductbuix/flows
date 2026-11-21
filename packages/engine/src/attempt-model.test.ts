import { describe, expect, it } from "vitest"
import { resolveAttemptModelFields } from "./attempt-model.ts"
import type { Workflow } from "@workspace/shared"

const baseGraph = {
  id: "w",
  tasks: [],
} as Workflow

describe("resolveAttemptModelFields", () => {
  it("records task model and effort with modelSource task", () => {
    const fields = resolveAttemptModelFields(
      {
        id: "a",
        kind: "agent",
        cli: "claude",
        model: "opus",
        effort: "high",
        needs: [],
      },
      baseGraph
    )
    expect(fields).toEqual({
      model: "opus",
      effort: "high",
      modelSource: "task",
    })
  })

  it("records workflow defaults with modelSource workflow", () => {
    const fields = resolveAttemptModelFields(
      {
        id: "a",
        kind: "agent",
        cli: "claude",
        needs: [],
      },
      {
        ...baseGraph,
        agent: { claude: { model: "sonnet", effort: "medium" } },
      }
    )
    expect(fields).toEqual({
      model: "sonnet",
      effort: "medium",
      modelSource: "workflow",
    })
  })

  it("uses cli modelSource when nothing is resolved", () => {
    const fields = resolveAttemptModelFields(
      {
        id: "a",
        kind: "agent",
        cli: "claude",
        needs: [],
      },
      baseGraph
    )
    expect(fields?.modelSource).toBe("cli")
  })

  it("returns undefined for command tasks", () => {
    expect(
      resolveAttemptModelFields(
        { id: "c", kind: "command", run: "true", needs: [] },
        baseGraph
      )
    ).toBeUndefined()
  })
})
