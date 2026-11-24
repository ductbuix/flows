import { createEngine } from "@workspace/engine"
import { ndjsonTransport } from "@workspace/protocol/node"
import { bindFcpTransport, createFcpHost } from "server/fcp-host"

/** Serve FCP over stdin/stdout (DES-040 stdio transport). */
export function serveEngineStdio(home: string): void {
  const engine = createEngine({ home })
  engine.resumeAll()
  const host = createFcpHost(engine)
  const transport = ndjsonTransport(process.stdin, process.stdout)
  bindFcpTransport(transport, engine, host)
  transport.onClose(() => {
    host.dispose()
    engine.close()
  })
}
