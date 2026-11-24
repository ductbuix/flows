import { peekLock } from "@workspace/adapters-node"
import { createEngine } from "@workspace/engine"
import { createLinkedTransports } from "@workspace/protocol"
import { createClient, type FlowsClient } from "@workspace/sdk"
import { bindFcpTransport, createFcpHost } from "server/fcp-host"

const CLIENT_INFO = { name: "flows-cli", version: "0.0.1" }

export type CliSession = {
  client: FlowsClient
  mode: "attach" | "in-process"
  close: () => void
}

/**
 * Attach to a live daemon via engine.lock, else host the engine in-process
 * over linked transports (DES-039 CLI topology).
 */
export async function openSession(home: string): Promise<CliSession> {
  const live = peekLock(home)
  if (live) {
    const client = createClient({
      url: live.url,
      token: live.token,
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
  return openInProcess(home)
}

export function openInProcess(home: string): Promise<CliSession> {
  const engine = createEngine({ home })
  engine.resumeAll()
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
    },
  }))
}
