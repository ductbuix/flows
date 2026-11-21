import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router"
import { WorkflowPage } from "./WorkflowPage"

vi.mock("@/pages/editor/WorkflowEditorPage", () => ({
  WorkflowEditorPage: () => <div data-testid="editor-page" />,
}))

vi.mock("./WorkflowRunsPage", () => ({
  WorkflowRunsPage: () => <div data-testid="runs-page" />,
}))

vi.mock("./WorkflowOverviewPage", () => ({
  WorkflowOverviewPage: () => <div data-testid="overview-page" />,
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
  it("shows overview by default; editor and runs by tab", () => {
    renderTab("?tab=runs")
    expect(screen.getByTestId("runs-page")).toBeTruthy()
    cleanup()

    renderTab("?tab=editor")
    expect(screen.getByTestId("editor-page")).toBeTruthy()
    cleanup()

    renderTab()
    expect(screen.getByTestId("overview-page")).toBeTruthy()
    cleanup()

    renderTab("?tab=overview")
    expect(screen.getByTestId("overview-page")).toBeTruthy()
    cleanup()

    renderTab("?tab=nope")
    expect(screen.getByTestId("overview-page")).toBeTruthy()
  })
})
