import { randomBytes } from "node:crypto"
import { acquireLock, releaseLock } from "@workspace/adapters-node"
import { createEngine } from "@workspace/adapters-node"
import { createLinkedTransports } from "@workspace/protocol"
import { createClient, type FlowsClient } from "@workspace/sdk"
import { bindFcpTransport, createFcpHost } from "server/fcp-host"

const CLIENT_INFO = { name: "flows-cli", version: "0.0.1" }
export const INPROC_URL = "inproc://flows-cli"

export type CliSession = {
  client: FlowsClient
  mode: "attach" | "in-process"
  close: () => void
}

/** Owners that serve no WebSocket (CLI in-process, desktop utility) cannot be attached to. */
export function isInprocUrl(url: string): boolean {
  return !/^wss?:\/\//.test(url)
}

export function engineBusyMessage(pid: number): string {
  return `engine busy, pid ${pid}`
}

function inprocSelf(): { url: string; token: string } {
  return { url: INPROC_URL, token: randomBytes(32).toString("base64url") }
}

/**
 * Attach to a live daemon via engine.lock, else host the engine in-process
 * over linked transports (DES-039 CLI topology).
 */
export async function openSession(home: string): Promise<CliSession> {
  const lock = acquireLock(home, inprocSelf())
  if ("attachTo" in lock) {
    if (isInprocUrl(lock.attachTo.url)) {
      throw new Error(engineBusyMessage(lock.attachTo.pid))
    }
    const client = createClient({
      url: lock.attachTo.url,
      token: lock.attachTo.token,
      clientInfo: CLIENT_INFO,
      capabilities: { updates: { coalesced: true } },
    })
    await client.ready
    return {
      client,
      mode: "attach",
      close: () => client.close(),
    }
  }
  return hostInProcess(home)
}

/** Host the engine in-process; takes engine.lock or fails if another host owns it. */
export async function openInProcess(home: string): Promise<CliSession> {
  const lock = acquireLock(home, inprocSelf())
  if ("attachTo" in lock) {
    throw new Error(
      isInprocUrl(lock.attachTo.url)
        ? engineBusyMessage(lock.attachTo.pid)
        : `FLOWAPP_HOME already owned at ${lock.attachTo.url}`
    )
  }
  return hostInProcess(home)
}

function hostInProcess(home: string): Promise<CliSession> {
  const engine = createEngine({ home })
  const host = createFcpHost(engine)
  const [serverTransport, clientTransport] = createLinkedTransports()
  bindFcpTransport(serverTransport, engine, host)
  const client = createClient({
    transport: clientTransport,
    clientInfo: CLIENT_INFO,
    capabilities: { updates: { coalesced: true } },
  })
  return client.ready.then(() => ({
    client,
    mode: "in-process" as const,
    close() {
      client.close()
      host.dispose()
      engine.close()
      releaseLock(home)
    },
  }))
}
