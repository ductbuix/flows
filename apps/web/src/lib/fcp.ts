import { createClient, type FlowsClient } from "@workspace/sdk"

export type FlowsFcpBootstrap = {
  token: string
  url: string
}

declare global {
  interface Window {
    __FLOWS_FCP__?: FlowsFcpBootstrap
  }
}

/** Resolve FCP bootstrap: daemon-served page, else Vite-proxied `/api/fcp`. */
export async function loadFcpBootstrap(): Promise<FlowsFcpBootstrap> {
  const embedded = window.__FLOWS_FCP__
  if (embedded?.token && embedded?.url) return embedded
  const res = await fetch("/api/fcp")
  if (!res.ok) {
    throw new Error(`Could not load FCP bootstrap (${res.status})`)
  }
  const body = (await res.json()) as FlowsFcpBootstrap
  if (!body.token || !body.url) {
    throw new Error("FCP bootstrap missing token or url")
  }
  return body
}

export function createWebFlowsClient(boot: FlowsFcpBootstrap): FlowsClient {
  return createClient({
    url: boot.url,
    token: boot.token,
    clientInfo: { name: "flows-web", version: "0.0.1" },
  })
}
