import { cleanup, render, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { createMemoryRouter, RouterProvider } from "react-router"
import {
  LegacyRunRedirect,
  LegacyWorkflowRunsRedirect,
} from "./LegacyRedirects"

afterEach(() => {
  cleanup()
})

describe("LegacyRedirects", () => {
  it("redirects /workflows/:id/runs to ?tab=runs and keeps params", async () => {
    const router = createMemoryRouter(
      [
        {
          path: "/workflows/:workflowId/runs",
          element: <LegacyWorkflowRunsRedirect />,
        },
        { path: "/workflows/:workflowId", element: <div /> },
      ],
      { initialEntries: ["/workflows/demo/runs?x=1"] }
    )
    render(<RouterProvider router={router} />)
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/workflows/demo")
      expect(router.state.location.search).toBe("?x=1&tab=runs")
    })
  })

  it("redirects /workflows/:id/runs/:runId to /runs/:runId", async () => {
    const router = createMemoryRouter(
      [
        {
          path: "/workflows/:workflowId/runs/:runId",
          element: <LegacyRunRedirect />,
        },
        { path: "/runs/:runId", element: <div /> },
      ],
      { initialEntries: ["/workflows/demo/runs/r1?view=graph&task=a"] }
    )
    render(<RouterProvider router={router} />)
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/runs/r1")
      expect(router.state.location.search).toBe("?view=graph&task=a")
    })
  })
})
