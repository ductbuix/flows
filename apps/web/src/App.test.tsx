import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router"
import { App } from "./App"

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
        return Response.json(handlers.runs ?? [])
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
