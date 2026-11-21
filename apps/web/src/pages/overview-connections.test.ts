import { describe, expect, it } from "vitest"
import type { Workflow } from "@workspace/shared"
import {
  overviewConnections,
  overviewImpacts,
  taskConnectionIds,
} from "./overview-connections"

const workflow: Workflow = {
  id: "demo",
  tasks: [
    {
      id: "one",
      kind: "command",
      run: "echo 1",
      uses: [
        { connection: "rally-pay", access: "read" },
        { connection: "confluence", access: "read" },
      ],
    },
    {
      id: "two",
      kind: "command",
      run: "echo 2",
      uses: [{ connection: "github-acme", access: "propose" }],
    },
  ],
}

describe("overview-connections", () => {
  it("lists unique connections and task ids", () => {
    expect(overviewConnections(workflow)).toEqual([
      {
        connection: "confluence",
        access: "read",
        taskIds: ["one"],
      },
      {
        connection: "github-acme",
        access: "propose",
        taskIds: ["two"],
      },
      {
        connection: "rally-pay",
        access: "read",
        taskIds: ["one"],
      },
    ])
  })

  it("derives impact badges from access", () => {
    expect(overviewImpacts(workflow)).toEqual(["read", "local"])
  })

  it("lists connection ids on a task", () => {
    expect(taskConnectionIds(workflow.tasks[0]!)).toEqual([
      "rally-pay",
      "confluence",
    ])
  })
})
