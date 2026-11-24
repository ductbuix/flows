import { createEngine } from "@workspace/engine"
import { bindFcpTransport, createFcpHost } from "server/fcp-host"
import {
  messagePortTransport,
  type MessagePortLike,
  type Transport,
} from "@workspace/protocol"

export type DesktopEngine = {
  home: string
  dispose: () => void
  bindTransport: (transport: Transport) => void
  bindPort: (port: MessagePortLike) => void
}

/**
 * Desktop utilityProcess host: same FCP + core run path as the daemon
 * and CLI (BL-197).
 */
export function composeDesktopEngine(home: string): DesktopEngine {
  const engine = createEngine({ home })
  const host = createFcpHost(engine)

  function bindTransport(transport: Transport): void {
    bindFcpTransport(transport, engine, host)
  }

  return {
    home,
    dispose: () => {
      host.dispose()
      engine.close()
    },
    bindTransport,
    bindPort(port) {
      bindTransport(messagePortTransport(port))
    },
  }
}
