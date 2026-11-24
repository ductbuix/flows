import { createClient, type FlowsClient } from "@workspace/sdk"
import { messagePortTransport, type Transport } from "@workspace/protocol"
import {
  desktopClientCapabilities,
  installDesktopHost,
} from "./desktop-host.ts"

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

async function loadWsBootstrap(): Promise<{
  url: string
  token: string
} | null> {
  const embedded = window.__FLOWS_FCP__
  if (embedded?.url) {
    return { url: embedded.url, token: embedded.token ?? "" }
  }
  try {
    const res = await fetch("/fcp/bootstrap")
    if (!res.ok) return null
    const body = (await res.json()) as { url?: string; token?: string }
    if (!body.url) return null
    return { url: body.url, token: body.token ?? "" }
  } catch {
    return null
  }
}

/**
 * Transport switch (DES-039 / BL-186): MessagePort in Electron via preload
 * `connect()`, WebSocket in the browser via `__FLOWS_FCP__` or `/fcp/bootstrap`.
 * Desktop also declares host capabilities (BL-189).
 */
export async function createAppClient(): Promise<FlowsClient | null> {
  if (typeof window === "undefined") return null

  if (window.flowsDesktop?.connect) {
    const client = createClient({
      transport: () => openDesktopTransport(),
      clientInfo: CLIENT_INFO,
      capabilities: desktopClientCapabilities(),
    })
    installDesktopHost(client)
    return client
  }

  const fcp = await loadWsBootstrap()
  if (fcp) {
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
