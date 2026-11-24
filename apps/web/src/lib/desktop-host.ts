import type { FlowsClient } from "@workspace/sdk"

const DESKTOP_CAPABILITIES = {
  host: { revealPath: true, notifications: true, browserSignIn: true },
} as const

export function desktopClientCapabilities() {
  return DESKTOP_CAPABILITIES
}

const INBOX_TITLE = {
  approval: "Approval needed",
  permission: "Permission needed",
  question: "Question from an agent",
  plan_review: "Plan needs review",
  sign_in: "Sign-in needed",
} as const

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
  let unsubNotice: (() => void) | undefined
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
    void client.call("subscribe", { topics: ["inbox", "notice"] })
    unsubInbox = client.onNotification("inbox/update", (params) => {
      if (params.kind !== "item_added") return
      const title = INBOX_TITLE[params.item.kind]
      api.notifyInboxItem({ title, body: params.item.question })
    })
    unsubNotice = client.onNotification("notice/update", (params) => {
      if (params.notice.channel !== "system") return
      api.notifySystem?.({
        title: params.notice.title,
        body: firstLine(params.notice.text),
      })
    })
  })

  return () => {
    closed = true
    unsubReveal?.()
    unsubSignIn?.()
    unsubInbox?.()
    unsubNotice?.()
    void client.call("unsubscribe", { topics: ["inbox", "notice"] })
  }
}

/** Body for a system notification: the first non-heading line of the text. */
function firstLine(text: string): string {
  const line = text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("#"))
  return (line ?? "").slice(0, 200)
}
