import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { App } from "./App"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("App", () => {
  it("shows the server version when health is ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ok: true, version: "9.9.9" }))
    )
    render(<App />)
    expect(screen.getByTestId("health").textContent).toBe("checking server")
    expect(await screen.findByText("server ok v9.9.9")).toBeTruthy()
  })

  it("shows server down when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline")
      })
    )
    render(<App />)
    expect(await screen.findByText("server down")).toBeTruthy()
  })
})
