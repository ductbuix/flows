import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router"
import { WorkflowPage } from "./WorkflowPage"

vi.mock("@/pages/editor/WorkflowEditorPage", () => ({
  WorkflowEditorPage: () => <div data-testid="editor-page" />,
}))

vi.mock("@/pages/WorkflowRunsPage", () => ({
  WorkflowRunsPage: () => <div data-testid="runs-page" />,
}))

afterEach(() => {
  cleanup()
})

function renderTab(search = "") {
  return render(
    <MemoryRouter initialEntries={[`/workflows/demo${search}`]}>
      <Routes>
        <Route path="/workflows/:workflowId" element={<WorkflowPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe("WorkflowPage", () => {
  it("shows runs for tab=runs and editor otherwise", () => {
    renderTab("?tab=runs")
    expect(screen.getByTestId("runs-page")).toBeTruthy()
    cleanup()

    renderTab()
    expect(screen.getByTestId("editor-page")).toBeTruthy()
    cleanup()

    renderTab("?tab=overview")
    expect(screen.getByTestId("editor-page")).toBeTruthy()
    cleanup()

    renderTab("?tab=nope")
    expect(screen.getByTestId("editor-page")).toBeTruthy()
  })
})
