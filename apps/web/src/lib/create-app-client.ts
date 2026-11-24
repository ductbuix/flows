import { createClient, type FlowsClient } from "@workspace/sdk"
import { messagePortTransport, type Transport } from "@workspace/protocol"

const CLIENT_INFO = { name: "flows-web", version: "0.0.1" }

function openDesktopTransport(): Promise<Transport> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener("message", onMsg)
      reject(new Error("flowsDesktop.connect: timed out waiting for port"))
    }, 10_000)
    function onMsg(event: MessageEvent) {
      if (event.source !== window) return
      if (
        typeof event.data !== "object" ||
        event.data === null ||
        (event.data as { type?: string }).type !== "flows-fcp-local-port"
      ) {
        return
      }
      const port = event.ports[0]
      if (!port) return
      clearTimeout(timer)
      window.removeEventListener("message", onMsg)
      resolve(messagePortTransport(port))
    }
    window.addEventListener("message", onMsg)
    window.flowsDesktop!.connect()
  })
}

/**
 * Transport switch (DES-039 / BL-186): MessagePort in Electron via preload
 * `connect()`, WebSocket in the browser when `__FLOWS_FCP__` is present.
 */
export function createAppClient(): FlowsClient | null {
  if (typeof window === "undefined") return null

  if (window.flowsDesktop?.connect) {
    return createClient({
      transport: () => openDesktopTransport(),
      clientInfo: CLIENT_INFO,
    })
  }

  const fcp = window.__FLOWS_FCP__
  if (fcp?.url) {
    return createClient({
      url: fcp.url,
      token: fcp.token,
      clientInfo: CLIENT_INFO,
    })
  }

  return null
}

export function isDesktopRenderer(): boolean {
  return typeof window !== "undefined" && !!window.flowsDesktop?.connect
}
