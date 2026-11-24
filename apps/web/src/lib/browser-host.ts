import type { FlowsClient } from "@workspace/sdk"

/** Browser can round-trip reveal for e2e; Finder open stays desktop-only. */
export const browserClientCapabilities = {
  host: { revealPath: true },
} as const

/**
 * Record `host/reveal_path` on the window so Playwright can assert the
 * `file/reveal` → host chain without Electron.
 */
export function installBrowserHost(client: FlowsClient): () => void {
  let unsub: (() => void) | undefined
  let closed = false

  void client.ready.then(() => {
    if (closed) return
    unsub = client.onRequest("host/reveal_path", (params) => {
      window.__FLOWS_LAST_REVEAL__ = params.path
      return {}
    })
  })

  return () => {
    closed = true
    unsub?.()
  }
}
