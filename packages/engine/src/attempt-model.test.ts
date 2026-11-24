import { describe, expect, it } from "vitest"
import { resolveAttemptModelFields } from "./attempt-model.ts"
import type { Workflow } from "@workspace/contracts"

const baseGraph = { id: "w" } as Workflow

describe("resolveAttemptModelFields", () => {
  it("records task model and effort with modelSource task", () => {
    const fields = resolveAttemptModelFields(
      {
        cli: "claude",
        model: "opus",
        effort: "high",
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
        cli: "claude",
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
        cli: "claude",
      },
      baseGraph
    )
    expect(fields?.modelSource).toBe("cli")
  })
})
