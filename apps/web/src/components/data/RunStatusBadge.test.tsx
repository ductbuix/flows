import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { RunStatusBadge } from "./RunStatusBadge"

afterEach(cleanup)

describe("RunStatusBadge", () => {
  it("maps each run status to its label", () => {
    const cases = [
      "queued",
      "running",
      "succeeded",
      "failed",
      "cancelled",
    ] as const
    for (const status of cases) {
      const { unmount } = render(<RunStatusBadge status={status} />)
      expect(screen.getByTestId("run-status").textContent).toContain(status)
      unmount()
    }
  })

  it("shows Awaiting approval when needsYou is set", () => {
    render(<RunStatusBadge status="running" needsYou />)
    expect(screen.getByTestId("run-status").textContent).toContain(
      "Awaiting approval"
    )
  })

  it("honors a custom data-testid", () => {
    render(<RunStatusBadge status="failed" data-testid="custom-status" />)
    expect(screen.getByTestId("custom-status").textContent).toContain("failed")
  })
})
