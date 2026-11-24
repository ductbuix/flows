import type { FlowsClient } from "@workspace/sdk"

const DESKTOP_CAPABILITIES = {
  host: { revealPath: true, notifications: true, browserSignIn: true },
} as const

export function desktopClientCapabilities() {
  return DESKTOP_CAPABILITIES
}

/**
 * Wire host capabilities for the Electron renderer (BL-189 / BL-190 / DES-040).
 */
export function installDesktopHost(client: FlowsClient): () => void {
  const api = window.flowsDesktop
  if (!api?.revealPath || !api.notifyInboxItem || !api.browserSignIn) {
    return () => {}
  }

  let unsubReveal: (() => void) | undefined
  let unsubSignIn: (() => void) | undefined
  let unsubInbox: (() => void) | undefined
  let closed = false

  void client.ready.then(() => {
    if (closed) return
    unsubReveal = client.onRequest("host/reveal_path", (params) => {
      api.revealPath(params.path)
      return {}
    })
    unsubSignIn = client.onRequest("host/browser_sign_in", (params) =>
      api.browserSignIn(params)
    )
    void client.call("subscribe", { topics: ["inbox"] })
    unsubInbox = client.onNotification("inbox/update", (params) => {
      if (params.kind !== "item_added") return
      const title =
        params.item.kind === "permission"
          ? "Permission needed"
          : "Approval needed"
      api.notifyInboxItem({ title, body: params.item.question })
    })
  })

  return () => {
    closed = true
    unsubReveal?.()
    unsubSignIn?.()
    unsubInbox?.()
    void client.call("unsubscribe", { topics: ["inbox"] })
  }
}
