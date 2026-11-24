import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { RunDetail } from "@workspace/shared"
import { afterEach, describe, expect, it, vi } from "vitest"
import { StepTable } from "./StepTable"

afterEach(cleanup)

const step = (
  nodeId: string,
  kind: string,
  pass: number,
  status: string,
  extra: Record<string, unknown> = {}
) => ({ nodeId, kind, pass, attempts: 1, status, ...extra })

/** A Judge loop: draft and check ran three times, the last verdict Yes. */
const run = {
  graph: {
    nodes: [{ id: "draft", name: "Draft" }, { id: "check" }, { id: "done" }],
  },
  steps: [
    step("draft", "command", 1, "succeeded"),
    step("draft", "command", 2, "succeeded"),
    step("draft", "command", 3, "failed", { failReason: "loop_limit" }),
    step("check", "judge", 1, "succeeded", { branch: "no" }),
    step("check", "judge", 2, "succeeded", { branch: "no" }),
    step("check", "judge", 3, "succeeded", { branch: "yes" }),
    step("done", "command", 1, "succeeded"),
  ],
} as unknown as RunDetail

describe("StepTable with several passes", () => {
  it("shows one row per pass with its own state and verdict", () => {
    render(<StepTable run={run} onSelectTask={() => {}} />)
    expect(screen.getAllByTestId(/^step-row-/)).toHaveLength(7)
    for (const key of ["draft-1", "draft-2", "draft-3", "check-3", "done-1"]) {
      expect(screen.getByTestId(`step-row-${key}`)).toBeTruthy()
    }
    expect(screen.getByTestId("step-state-draft-2").textContent).toBe(
      "succeeded"
    )
    expect(screen.getByTestId("step-state-draft-3").textContent).toBe("failed")
    expect(screen.getByTestId("step-verdict-draft-3").textContent).toBe(
      "Loop limit"
    )
    expect(
      ["check-1", "check-2", "check-3"].map(
        (k) => screen.getByTestId(`step-verdict-${k}`).textContent
      )
    ).toEqual(["No", "No", "Yes"])
    expect(screen.getByTestId("step-row-draft-3").textContent).toContain("3")
  })

  it("selects the node when any of its passes is clicked", () => {
    const onSelect = vi.fn()
    render(<StepTable run={run} onSelectTask={onSelect} />)
    fireEvent.click(screen.getByTestId("step-row-check-2"))
    expect(onSelect).toHaveBeenCalledWith("check")
  })
})
