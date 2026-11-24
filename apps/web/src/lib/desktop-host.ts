import type { FlowsClient } from "@workspace/sdk"

const DESKTOP_CAPABILITIES = {
  host: { revealPath: true, notifications: true },
} as const

export function desktopClientCapabilities() {
  return DESKTOP_CAPABILITIES
}

/**
 * Wire host/reveal_path and Inbox OS notifications for the Electron
 * renderer (BL-189 / DES-040).
 */
export function installDesktopHost(client: FlowsClient): () => void {
  const api = window.flowsDesktop
  if (!api?.revealPath || !api.notifyInboxItem) {
    return () => {}
  }

  let unsubReveal: (() => void) | undefined
  let unsubInbox: (() => void) | undefined
  let closed = false

  void client.ready.then(() => {
    if (closed) return
    unsubReveal = client.onRequest("host/reveal_path", (params) => {
      api.revealPath(params.path)
      return {}
    })
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
    unsubInbox?.()
    void client.call("unsubscribe", { topics: ["inbox"] })
  }
}
