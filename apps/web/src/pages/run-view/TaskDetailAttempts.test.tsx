import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import type { RunDetail, TaskView } from "@workspace/shared"
import { TaskDetailAttempts } from "./TaskDetailAttempts"

afterEach(cleanup)

const run = {
  id: "r1",
  workflowId: "w1",
  status: "running",
  startedAt: "2026-01-01T00:00:00.000Z",
  sandboxed: true,
  lastSeq: 1,
  graph: {
    id: "w1",
    tasks: [{ id: "hello", kind: "agent", cli: "claude", needs: [] }],
  },
  tasks: [],
  taskCounts: { total: 1, finished: 0, awaitingApproval: 0 },
  inputFiles: [],
} as RunDetail

describe("TaskDetailAttempts model row", () => {
  it("shows model, effort, and source on an agent attempt", () => {
    const task = {
      id: "hello",
      status: "running",
      spawned: false,
      attempts: [
        {
          attempt: 1,
          pid: 9,
          kind: {
            kind: "run",
            label: "Run",
            ariaLabel: "First run",
          },
          model: "haiku",
          effort: "low",
          modelSource: "task",
        },
      ],
    } as TaskView

    render(<TaskDetailAttempts run={run} task={task} />)
    expect(screen.getByTestId("attempt-model-1").textContent).toBe(
      "haiku · low · via task"
    )
  })
})
