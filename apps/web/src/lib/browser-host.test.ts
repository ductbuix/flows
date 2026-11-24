import { afterEach, describe, expect, it, vi } from "vitest"
import {
  browserClientCapabilities,
  installBrowserHost,
} from "./browser-host.ts"

describe("browser-host", () => {
  afterEach(() => {
    delete window.__FLOWS_LAST_REVEAL__
  })

  it("declares revealPath only", () => {
    expect(browserClientCapabilities).toEqual({
      host: { revealPath: true },
    })
  })

  it("records host/reveal_path on the window", async () => {
    let handler:
      ((params: { path: string }) => Record<string, never>) | undefined
    const client = {
      ready: Promise.resolve({}),
      onRequest: (
        _method: string,
        fn: (params: { path: string }) => Record<string, never>
      ) => {
        handler = fn
        return () => {}
      },
    }
    installBrowserHost(client as never)
    await vi.waitFor(() => expect(handler).toBeDefined())
    expect(handler!({ path: "/tmp/board.yaml" })).toEqual({})
    expect(window.__FLOWS_LAST_REVEAL__).toBe("/tmp/board.yaml")
  })
})
