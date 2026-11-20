import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router"
import { App } from "./App"

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
      if (url.includes("/api/workflows") && !url.includes("/runs")) {
        return Response.json(handlers.workflows ?? [])
      }
      throw new Error(`unexpected fetch: ${url}`)
    })
  )
}

describe("App", () => {
  it("lists workflows on the home route", async () => {
    mockFetch({
      workflows: [{ id: "demo", goal: "test goal" }],
    })
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    )
    expect(await screen.findByText("demo")).toBeTruthy()
    expect(screen.getByText("test goal")).toBeTruthy()
  })
})
