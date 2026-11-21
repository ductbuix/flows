import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router"
import { App } from "./App"
import { ThemeProvider } from "@/components/theme-provider"

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
  class MockWebSocket {
    addEventListener = vi.fn()
    close = vi.fn()
    send = vi.fn()
    readyState = 1
  }
  vi.stubGlobal("WebSocket", MockWebSocket)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function mockFetch(handlers: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url
      if (url.includes("/api/workflows/") && url.endsWith("/runs")) {
        return Response.json(handlers.workflowRuns ?? handlers.runs ?? [])
      }
      if (/\/api\/runs(\?|$)/.test(url) || url.endsWith("/api/runs")) {
        return Response.json(handlers.allRuns ?? handlers.runs ?? [])
      }
      if (url.includes("/api/cli-status")) {
        return Response.json(
          handlers.cliStatus ?? {
            clis: [
              { id: "claude", installed: false, version: null },
              { id: "cursor", installed: false, version: null },
            ],
          }
        )
      }
      if (url.includes("/api/trust")) {
        return Response.json(
          handlers.trust ?? {
            trust: "none",
            homeRealpath: "/tmp/flowapp",
            alwaysTrusted: false,
          }
        )
      }
      if (url.includes("/api/workflows") && !url.includes("/runs")) {
        return Response.json(handlers.workflows ?? [])
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
  )
}

const demoWorkflow = { id: "demo", goal: "test goal", taskCount: 1 }

function renderApp(path = "/") {
  return render(
    <ThemeProvider defaultTheme="light">
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </ThemeProvider>
  )
}

describe("App", () => {
  it("lists workflows in the sidebar and shows home empty state", async () => {
    mockFetch({ workflows: [demoWorkflow] })
    renderApp("/")
    expect(await screen.findByTestId("sidebar-workflow-demo")).toBeTruthy()
    expect(await screen.findByTestId("sidebar-platform")).toBeTruthy()
    expect(await screen.findByTestId("home-empty")).toBeTruthy()
    expect(screen.getByText(/Select a workflow or create one/i)).toBeTruthy()
  })

  it("shows sidebar empty when there are no workflows", async () => {
    mockFetch({ workflows: [] })
    renderApp("/")
    expect(await screen.findByTestId("sidebar-workflows-empty")).toBeTruthy()
    expect(screen.getByTestId("sidebar-settings")).toBeTruthy()
    expect(screen.getByTestId("sidebar-home")).toBeTruthy()
  })

  it("shows sidebar skeletons while workflows load", async () => {
    let resolveWorkflows!: (value: Response) => void
    const workflowsPromise = new Promise<Response>((resolve) => {
      resolveWorkflows = resolve
    })
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url
        if (url.includes("/api/workflows") && !url.includes("/runs")) {
          return workflowsPromise
        }
        throw new Error(`unexpected fetch: ${url}`)
      })
    )
    renderApp("/")
    expect(await screen.findByTestId("sidebar-workflow-loading")).toBeTruthy()
    resolveWorkflows(Response.json([]))
    expect(await screen.findByTestId("sidebar-workflows-empty")).toBeTruthy()
  })

  it("shows the runs list for ?tab=runs", async () => {
    mockFetch({
      workflows: [demoWorkflow],
      workflowRuns: [],
    })
    renderApp("/workflows/demo?tab=runs")
    expect(await screen.findByTestId("run-list")).toBeTruthy()
  })

  it("shows the workflows page table", async () => {
    mockFetch({ workflows: [demoWorkflow], allRuns: [] })
    renderApp("/workflows")
    expect(await screen.findByTestId("workflows-page")).toBeTruthy()
    expect(await screen.findByTestId("workflows-table")).toBeTruthy()
    expect(screen.getByTestId("workflows-row-demo")).toBeTruthy()
  })

  it("shows the runs page empty state", async () => {
    mockFetch({ workflows: [demoWorkflow], allRuns: [] })
    renderApp("/runs")
    expect(await screen.findByTestId("runs-page")).toBeTruthy()
    expect(await screen.findByTestId("runs-empty")).toBeTruthy()
  })
})
